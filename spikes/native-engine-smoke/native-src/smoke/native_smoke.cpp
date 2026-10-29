#include <jni.h>  // Android JNI smoke entry points.
#include <rime_api.h>
#include <unistd.h>

#include <cstdint>
#include <sstream>
#include <string>

extern "C" {
const char* feelime_rime_version();
int feelime_rime_has_required_api();
int feelime_rime_initialize(const char*, const char*, const char*);
int feelime_rime_start_maintenance(int);
int feelime_rime_is_maintenance_mode();
void feelime_rime_join_maintenance();
std::uintptr_t feelime_rime_create_session(const char*);
int feelime_rime_process_key(std::uintptr_t, int, int);
int feelime_rime_select_candidate(std::uintptr_t, std::size_t);
int feelime_rime_select_candidate_absolute(std::uintptr_t, std::size_t);
int feelime_rime_delete_candidate_absolute(std::uintptr_t, std::size_t);
int feelime_rime_context_at_page(
    std::uintptr_t, int, char*, std::size_t, char*, std::size_t,
    int*, int*, int*, int*);
int feelime_rime_get_context(
    std::uintptr_t, char*, std::size_t, char*, std::size_t, int*, int*);
int feelime_rime_get_commit(std::uintptr_t, char*, std::size_t);
void feelime_rime_destroy_session(std::uintptr_t);
void feelime_rime_finalize();

const char* feelime_hunspell_version();
void* feelime_hunspell_create(const char*, const char*);
void feelime_hunspell_destroy(void*);
int feelime_hunspell_spell(void*, const char*);
int feelime_hunspell_suggest(void*, const char*, char*, std::size_t);
}

namespace {

std::string from_java(JNIEnv* env, jstring value) {
  const char* chars = env->GetStringUTFChars(value, nullptr);
  std::string result(chars == nullptr ? "" : chars);
  if (chars != nullptr) env->ReleaseStringUTFChars(value, chars);
  return result;
}

std::string json_escape(const std::string& value) {
  std::string out;
  for (char c : value) {
    if (c == '\\' || c == '"') out.push_back('\\');
    if (c == '\n') {
      out += "\\n";
    } else {
      out.push_back(c);
    }
  }
  return out;
}

void append_candidate(std::string* output, const char* text, const char* comment) {
  if (text != nullptr) output->append(text);
  if (comment != nullptr && comment[0] != '\0') {
    output->push_back('\t');
    output->append(comment);
  }
}

}  // namespace

extern "C" JNIEXPORT jlong JNICALL
Java_com_feelime_ime_nativeengine_MainActivity_pageSize(JNIEnv*, jobject) {
  return static_cast<jlong>(sysconf(_SC_PAGESIZE));
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_feelime_ime_nativeengine_NativeSmoke_runRime(
    JNIEnv* env, jclass, jstring shared_dir, jstring user_dir) {
  const std::string shared = from_java(env, shared_dir);
  const std::string user = from_java(env, user_dir);
  const int initialized = feelime_rime_initialize(shared.c_str(), user.c_str(), nullptr);
  const std::uintptr_t session = initialized ? feelime_rime_create_session("luna_pinyin") : 0;
  for (char c : std::string("nihao")) {
    if (session != 0) feelime_rime_process_key(session, c, 0);
  }
  char preedit[1024] = {};
  char candidates[16384] = {};
  int page_no = 0;
  int is_last_page = 1;
  const int context = session == 0 ? -9 : feelime_rime_get_context(
      session, preedit, sizeof(preedit), candidates, sizeof(candidates),
      &page_no, &is_last_page);
  if (session != 0) feelime_rime_process_key(session, ' ', 0);
  char commit[1024] = {};
  const int committed = session == 0 ? -9 : feelime_rime_get_commit(session, commit, sizeof(commit));
  if (session != 0) feelime_rime_destroy_session(session);
  feelime_rime_finalize();
  std::ostringstream out;
  out << "{\"version\":\"" << json_escape(feelime_rime_version())
      << "\",\"requiredApi\":" << feelime_rime_has_required_api()
      << ",\"initialized\":" << initialized
      << ",\"contextCode\":" << context
      << ",\"preedit\":\"" << json_escape(preedit)
      << "\",\"candidates\":\"" << json_escape(candidates)
      << "\",\"pageNo\":" << page_no
      << ",\"isLastPage\":" << is_last_page
      << ",\"commitCode\":" << committed
      << ",\"commit\":\"" << json_escape(commit) << "\"}";
  return env->NewStringUTF(out.str().c_str());
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_feelime_ime_nativeengine_NativeSmoke_runHunspell(
    JNIEnv* env, jclass, jstring fr_aff, jstring fr_dic,
    jstring ru_aff, jstring ru_dic) {
  const std::string fr_aff_path = from_java(env, fr_aff);
  const std::string fr_dic_path = from_java(env, fr_dic);
  const std::string ru_aff_path = from_java(env, ru_aff);
  const std::string ru_dic_path = from_java(env, ru_dic);
  void* fr = feelime_hunspell_create(fr_aff_path.c_str(), fr_dic_path.c_str());
  void* ru = feelime_hunspell_create(ru_aff_path.c_str(), ru_dic_path.c_str());
  char fr_suggestions[16384] = {};
  char ru_suggestions[16384] = {};
  const int fr_count = fr == nullptr ? -1 :
      feelime_hunspell_suggest(fr, "bonjor", fr_suggestions, sizeof(fr_suggestions));
  const int ru_count = ru == nullptr ? -1 :
      feelime_hunspell_suggest(ru, "превет", ru_suggestions, sizeof(ru_suggestions));
  const int fr_correct = fr == nullptr ? -1 : feelime_hunspell_spell(fr, "bonjour");
  const int fr_apostrophe = fr == nullptr ? -1 : feelime_hunspell_spell(fr, "l'homme");
  const int ru_correct = ru == nullptr ? -1 : feelime_hunspell_spell(ru, "привет");
  if (fr != nullptr) feelime_hunspell_destroy(fr);
  if (ru != nullptr) feelime_hunspell_destroy(ru);
  std::ostringstream out;
  out << "{\"version\":\"" << feelime_hunspell_version()
      << "\",\"frCorrect\":" << fr_correct
      << ",\"frApostrophe\":" << fr_apostrophe
      << ",\"frSuggestionCount\":" << fr_count
      << ",\"frSuggestions\":\"" << json_escape(fr_suggestions)
      << "\",\"ruCorrect\":" << ru_correct
      << ",\"ruSuggestionCount\":" << ru_count
      << ",\"ruSuggestions\":\"" << json_escape(ru_suggestions) << "\"}";
  return env->NewStringUTF(out.str().c_str());
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_feelime_ime_nativeengine_NativeSmoke_rimeInitialize(
    JNIEnv* env, jclass, jstring shared_dir, jstring user_dir, jstring staging_dir) {
  const std::string shared = from_java(env, shared_dir);
  const std::string user = from_java(env, user_dir);
  const std::string staging = staging_dir != nullptr ? from_java(env, staging_dir) : std::string();
  return feelime_rime_initialize(shared.c_str(), user.c_str(),
                                 staging.empty() ? nullptr : staging.c_str()) != 0;
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_feelime_ime_nativeengine_NativeSmoke_rimeStartMaintenance(
    JNIEnv*, jclass, jboolean full_check) {
  return feelime_rime_start_maintenance(full_check ? 1 : 0) != 0;
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_feelime_ime_nativeengine_NativeSmoke_rimeIsMaintenanceMode(
    JNIEnv*, jclass) {
  return feelime_rime_is_maintenance_mode() != 0;
}

extern "C" JNIEXPORT void JNICALL
Java_com_feelime_ime_nativeengine_NativeSmoke_rimeJoinMaintenance(JNIEnv*, jclass) {
  feelime_rime_join_maintenance();
}

extern "C" JNIEXPORT jlong JNICALL
Java_com_feelime_ime_nativeengine_NativeSmoke_rimeCreateSession(
    JNIEnv* env, jclass, jstring schema_id) {
  const std::string schema = from_java(env, schema_id);
  return static_cast<jlong>(feelime_rime_create_session(schema.c_str()));
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_feelime_ime_nativeengine_NativeSmoke_rimeProcessKey(
    JNIEnv*, jclass, jlong session, jint key_code, jint modifiers) {
  return feelime_rime_process_key(static_cast<std::uintptr_t>(session), key_code, modifiers) != 0;
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_feelime_ime_nativeengine_NativeSmoke_rimeSelectCandidate(
    JNIEnv*, jclass, jlong session, jint page_index) {
  return feelime_rime_select_candidate(
      static_cast<std::uintptr_t>(session), static_cast<std::size_t>(page_index)) != 0;
}

// #72 只读候选通道：绝对下标选/删 + 按应用页读取（不挪 selector 高亮）。
extern "C" JNIEXPORT jboolean JNICALL
Java_com_feelime_ime_nativeengine_NativeSmoke_rimeSelectCandidateAbsolute(
    JNIEnv*, jclass, jlong session, jint index) {
  return feelime_rime_select_candidate_absolute(
      static_cast<std::uintptr_t>(session), static_cast<std::size_t>(index)) != 0;
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_feelime_ime_nativeengine_NativeSmoke_rimeDeleteCandidateAbsolute(
    JNIEnv*, jclass, jlong session, jint index) {
  return feelime_rime_delete_candidate_absolute(
      static_cast<std::uintptr_t>(session), static_cast<std::size_t>(index)) != 0;
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_feelime_ime_nativeengine_NativeSmoke_rimeContextAtPage(
    JNIEnv* env, jclass, jlong session, jint view_page) {
  const RimeApi* api = rime_get_api();
  int code = 0;
  const int page_no = view_page;
  int is_last_page = 1;
  int has_next = 0;
  int page_size = 0;
  std::string preedit;
  std::string candidates;
  if (api == nullptr || session == 0 || view_page < 0) {
    code = -2;
  } else {
    RIME_STRUCT(RimeContext, context);
    if (!api->get_context(static_cast<RimeSessionId>(session), &context)) {
      code = -2;
    } else {
      page_size = context.menu.page_size;
      preedit = context.composition.preedit == nullptr
          ? "" : context.composition.preedit;
      api->free_context(&context);
      if (page_size > 0) {
        RimeCandidateListIterator iterator = {};
        if (!api->candidate_list_from_index(
                static_cast<RimeSessionId>(session), &iterator,
                view_page * page_size)) {
          code = -4;
        } else {
          bool page_empty = true;
          for (int i = 0; i < page_size; ++i) {
            if (!api->candidate_list_next(&iterator)) break;
            page_empty = false;
            if (i > 0) candidates.push_back('\n');
            append_candidate(
                &candidates, iterator.candidate.text, iterator.candidate.comment);
          }
          has_next = api->candidate_list_next(&iterator) ? 1 : 0;
          api->candidate_list_end(&iterator);
          if (page_empty) code = -4;
          is_last_page = has_next ? 0 : 1;
        }
      }
    }
  }
  std::ostringstream out;
  out << "{\"code\":" << code << ",\"preedit\":\"" << json_escape(preedit)
      << "\",\"candidates\":\"" << json_escape(candidates)
      << "\",\"pageNo\":" << page_no
      << ",\"isLastPage\":" << is_last_page
      << ",\"hasNext\":" << has_next
      << ",\"pageSize\":" << page_size << "}";
  return env->NewStringUTF(out.str().c_str());
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_feelime_ime_nativeengine_NativeSmoke_rimeContext(
    JNIEnv* env, jclass, jlong session) {
  const RimeApi* api = rime_get_api();
  int code = -2;
  int page_no = 0;
  int is_last_page = 1;
  std::string preedit;
  std::string candidates;
  if (api != nullptr && session != 0) {
    RIME_STRUCT(RimeContext, context);
    if (api->get_context(static_cast<RimeSessionId>(session), &context)) {
      code = 1;
      preedit = context.composition.preedit == nullptr
          ? "" : context.composition.preedit;
      for (int i = 0; i < context.menu.num_candidates; ++i) {
        if (i > 0) candidates.push_back('\n');
        append_candidate(
            &candidates, context.menu.candidates[i].text,
            context.menu.candidates[i].comment);
      }
      page_no = context.menu.page_no;
      is_last_page = context.menu.is_last_page ? 1 : 0;
      api->free_context(&context);
    }
  }
  std::ostringstream out;
  out << "{\"code\":" << code << ",\"preedit\":\"" << json_escape(preedit)
      << "\",\"candidates\":\"" << json_escape(candidates)
      << "\",\"pageNo\":" << page_no
      << ",\"isLastPage\":" << is_last_page << "}";
  return env->NewStringUTF(out.str().c_str());
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_feelime_ime_nativeengine_NativeSmoke_rimeCommit(
    JNIEnv* env, jclass, jlong session) {
  char commit[1024] = {};
  feelime_rime_get_commit(static_cast<std::uintptr_t>(session), commit, sizeof(commit));
  return env->NewStringUTF(commit);
}

extern "C" JNIEXPORT void JNICALL
Java_com_feelime_ime_nativeengine_NativeSmoke_rimeDestroySession(
    JNIEnv*, jclass, jlong session) {
  feelime_rime_destroy_session(static_cast<std::uintptr_t>(session));
}

extern "C" JNIEXPORT void JNICALL
Java_com_feelime_ime_nativeengine_NativeSmoke_rimeFinalize(JNIEnv*, jclass) {
  feelime_rime_finalize();
}

extern "C" JNIEXPORT jlong JNICALL
Java_com_feelime_ime_nativeengine_NativeSmoke_hunspellCreate(
    JNIEnv* env, jclass, jstring aff_path, jstring dic_path) {
  const std::string aff = from_java(env, aff_path);
  const std::string dic = from_java(env, dic_path);
  return reinterpret_cast<jlong>(feelime_hunspell_create(aff.c_str(), dic.c_str()));
}

extern "C" JNIEXPORT jint JNICALL
Java_com_feelime_ime_nativeengine_NativeSmoke_hunspellSpell(
    JNIEnv* env, jclass, jlong handle, jstring word) {
  const std::string value = from_java(env, word);
  return feelime_hunspell_spell(reinterpret_cast<void*>(handle), value.c_str());
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_feelime_ime_nativeengine_NativeSmoke_hunspellSuggest(
    JNIEnv* env, jclass, jlong handle, jstring word) {
  const std::string value = from_java(env, word);
  char suggestions[16384] = {};
  feelime_hunspell_suggest(
      reinterpret_cast<void*>(handle), value.c_str(), suggestions, sizeof(suggestions));
  return env->NewStringUTF(suggestions);
}

extern "C" JNIEXPORT void JNICALL
Java_com_feelime_ime_nativeengine_NativeSmoke_hunspellDestroy(
    JNIEnv*, jclass, jlong handle) {
  feelime_hunspell_destroy(reinterpret_cast<void*>(handle));
}
