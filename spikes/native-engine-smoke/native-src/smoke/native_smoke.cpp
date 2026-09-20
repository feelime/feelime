#include <jni.h>  // Android JNI smoke entry points.
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

extern "C" JNIEXPORT jstring JNICALL
Java_com_feelime_ime_nativeengine_NativeSmoke_rimeContext(
    JNIEnv* env, jclass, jlong session) {
  char preedit[1024] = {};
  char candidates[16384] = {};
  int page_no = 0;
  int is_last_page = 1;
  const int code = feelime_rime_get_context(
      static_cast<std::uintptr_t>(session), preedit, sizeof(preedit),
      candidates, sizeof(candidates), &page_no, &is_last_page);
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
