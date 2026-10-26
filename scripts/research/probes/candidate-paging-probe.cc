// Host probe for the #72 candidate-paging invariant (2026-10-27).
//
// Modes (argv[3]):
//   pages     — old-shell behavior: after every key, PAGE_DOWN x2 (what the
//               collapsed-bar preload did per frame). Reproduces the frame-5
//               regression on the ace user dict (nihlk -> "ni h lk" / 你好老)
//               when stable_segmentation is on: the page walk drags the
//               selector highlight, the stable hint reads a deep-page
//               candidate's partial spans, and the hl anchor is lost.
//   iterator  — new-shell behavior: read the candidate list via
//               candidate_list_from_index (what rimeContextAtPage does).
//               MUST leave the frame state byte-identical (exit 2 + MUTATED
//               dump otherwise).
//   none      — control: no browsing traffic between keys.
//
// Build & run against a native work dir's host librime (see
// run-candidate-paging-probe.sh). Device conviction evidence (2026-10-27,
// kept in the case archive, not in-repo): per-frame native trace showed the
// selector highlight walked 0->5->10 by the collapsed-bar preload on every
// key, and hint snapshots taken from ASCII user_table candidates carried no
// syllable spans.
#include <rime_api.h>
#include <rime/service.h>
#include <rime/context.h>
#include <rime/candidate.h>
#include <rime/gear/translator_commons.h>
#include <sstream>
#include <iostream>
#include <cstdlib>
#include <cassert>
using namespace rime;
std::string snapshot(RimeSessionId sid) {
 auto api=rime_get_api();auto ctx=Service::instance().GetSession(sid)->context();
 std::ostringstream s;s<<"raw="<<ctx->input()<<" caret="<<ctx->caret_pos()<<" preedit=["<<ctx->GetPreedit().text<<"]";
 for(auto&seg:ctx->composition()) {s<<" seg="<<seg.start<<":"<<seg.end<<":"<<seg.status<<" selected="<<seg.selected_index<<" tags=";for(auto&t:seg.tags)s<<t<<",";
 auto p=As<Phrase>(Candidate::GetGenuineCandidate(seg.GetSelectedCandidate()));if(p){s<<" selectedSpans=";auto spans=p->spans();for(auto v:spans.vertices())s<<v<<",";}
 s<<" top5=";for(int i=0;i<5;i++){auto c=seg.GetCandidateAt(i);if(!c)break;s<<c->text()<<"|";}
 // 前 10 项每项 spans 顶点数（非 Phrase / 无 spans 记 0）。runner 用它断言
 // ascii8 fixture 的「首个结构合法 spans 候选在首页之外」前提成立。
 s<<" spanN=";for(int i=0;i<10;i++){auto c=seg.GetCandidateAt(i);if(!c)break;auto p=As<Phrase>(Candidate::GetGenuineCandidate(c));s<<(p?p->spans().vertices().size():0)<<",";}}
 RIME_STRUCT(RimeCommit,commit);assert(!api->get_commit(sid,&commit));return s.str();
}
int main(int argc,char**argv){
 assert(argc==4);auto api=rime_get_api();RIME_STRUCT(RimeTraits,t);t.shared_data_dir=getenv("PROBE_SHARED");t.user_data_dir=getenv("PROBE_USER");t.staging_dir=getenv("PROBE_BUILD");t.min_log_level=3;api->setup(&t);api->initialize(&t);
 auto sid=api->create_session();assert(api->select_schema(sid,argv[1]));
 for(char ch:std::string(argv[2])){api->process_key(sid,ch=='-'?0xff08:ch,0);auto before=snapshot(sid);std::cout<<"KEY "<<ch<<" "<<before<<"\n";
 if(std::string(argv[3])=="pages"){api->process_key(sid,0xff56,0);api->process_key(sid,0xff56,0);std::cout<<"AFTER "<<snapshot(sid)<<"\n";}
 else if(std::string(argv[3])=="iterator") {for(int start:{0,5,10,15,1000}){RimeCandidateListIterator it={};if(api->candidate_list_from_index(sid,&it,start)){for(int i=0;i<6&&api->candidate_list_next(&it);i++){}api->candidate_list_end(&it);}}
 auto after=snapshot(sid);if(after!=before){std::cerr<<"MUTATED "<<before<<"\n"<<after<<"\n";return 2;}}
 }
 // 终帧实际提交断言（runner 期望「你还看/不用找房东/不知道是」）：
 // 空格确认高亮（#0）后收割 commit。
 if(getenv("PROBE_COMMIT")){api->process_key(sid,0x20,0);RIME_STRUCT(RimeCommit,commit);if(api->get_commit(sid,&commit)&&commit.text){std::cout<<"COMMIT "<<commit.text<<"\n";api->free_commit(&commit);}}
 api->destroy_session(sid);api->finalize();
}
