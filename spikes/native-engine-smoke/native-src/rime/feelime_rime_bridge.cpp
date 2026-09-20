// Feelime's original bounded C ABI for the isolated Android feasibility spike.
// librime itself is built without source changes from the pinned upstream tree.

#include <rime_api.h>

#include <cstddef>
#include <cstdint>
#include <cstring>
#include <mutex>
#include <string>

#define FEELIME_EXPORT extern "C" __attribute__((visibility("default")))

namespace {

std::mutex g_mutex;
bool g_initialized = false;

bool copy_result(const std::string& value, char* output, std::size_t output_size) {
  if (output == nullptr || output_size == 0 || value.size() >= output_size) {
    return false;
  }
  std::memcpy(output, value.data(), value.size());
  output[value.size()] = '\0';
  return true;
}

}  // namespace

FEELIME_EXPORT const char* feelime_rime_version() {
  return rime_get_api()->get_version();
}

FEELIME_EXPORT int feelime_rime_has_required_api() {
  const RimeApi* api = rime_get_api();
  return api != nullptr && api->setup != nullptr && api->initialize != nullptr &&
         api->create_session != nullptr && api->process_key != nullptr &&
         api->get_context != nullptr && api->get_commit != nullptr &&
         api->select_candidate_on_current_page != nullptr &&
         api->destroy_session != nullptr && api->finalize != nullptr &&
         api->start_maintenance != nullptr &&
         api->join_maintenance_thread != nullptr &&
         api->is_maintenance_mode != nullptr;
}

FEELIME_EXPORT int feelime_rime_initialize(const char* shared_data_dir,
                                         const char* user_data_dir,
                                         const char* staging_dir) {
  if (shared_data_dir == nullptr || user_data_dir == nullptr) {
    return 0;
  }
  std::lock_guard<std::mutex> lock(g_mutex);
  if (g_initialized) {
    return 1;
  }
  const RimeApi* api = rime_get_api();
  RIME_STRUCT(RimeTraits, traits);
  traits.shared_data_dir = shared_data_dir;
  traits.user_data_dir = user_data_dir;
  traits.prebuilt_data_dir = shared_data_dir;
  // librime uses an EXPLICIT staging_dir verbatim (it does not append
  // "build/"). Point it at <user>/build so maintenance products land
  // exactly where the runtime's staging-first resolution expects them,
  // instead of polluting the user root next to the yaml sources.
  traits.staging_dir = staging_dir != nullptr ? staging_dir : user_data_dir;
  traits.distribution_name = "Feelime native smoke";
  traits.distribution_code_name = "feelime-native-smoke";
  traits.distribution_version = "1";
  traits.app_name = "rime.feelime_m0";
  traits.min_log_level = 2;
  traits.log_dir = "";
  api->setup(&traits);
  api->initialize(&traits);
  g_initialized = true;
  return 1;
}

// ---- Deployment maintenance (issue #23: user base-dict rebuild on device).
// start_maintenance spawns librime's deployer thread against the traits dirs
// configured at initialize() time (staging_dir == user_data_dir), producing
// table/prism/reverse bins under <user>/build that shadow the shared copy.
FEELIME_EXPORT int feelime_rime_start_maintenance(int full_check) {
  std::lock_guard<std::mutex> lock(g_mutex);
  if (!g_initialized) {
    return 0;
  }
  return rime_get_api()->start_maintenance(full_check);
}

FEELIME_EXPORT int feelime_rime_is_maintenance_mode() {
  return rime_get_api()->is_maintenance_mode();
}

FEELIME_EXPORT void feelime_rime_join_maintenance() {
  // Deliberately NOT under g_mutex: join blocks for minutes on big dicts.
  // Holding the lock would freeze every engine call (the keyboard must keep
  // serving the OLD dict while the rebuild runs).
  rime_get_api()->join_maintenance_thread();
}

FEELIME_EXPORT std::uintptr_t feelime_rime_create_session(const char* schema_id) {  std::lock_guard<std::mutex> lock(g_mutex);
  if (!g_initialized) {
    return 0;
  }
  const RimeApi* api = rime_get_api();
  const RimeSessionId session = api->create_session();
  if (session == 0 ||
      (schema_id != nullptr && !api->select_schema(session, schema_id))) {
    if (session != 0) {
      api->destroy_session(session);
    }
    return 0;
  }
  return session;
}

FEELIME_EXPORT int feelime_rime_process_key(std::uintptr_t session,
                                          int keycode,
                                          int modifiers) {
  std::lock_guard<std::mutex> lock(g_mutex);
  return g_initialized && session != 0 &&
         rime_get_api()->process_key(session, keycode, modifiers);
}

FEELIME_EXPORT int feelime_rime_select_candidate(std::uintptr_t session,
                                               std::size_t page_index) {
  std::lock_guard<std::mutex> lock(g_mutex);
  return g_initialized && session != 0 &&
         rime_get_api()->select_candidate_on_current_page(session, page_index);
}

FEELIME_EXPORT int feelime_rime_get_context(std::uintptr_t session,
                                          char* preedit,
                                          std::size_t preedit_size,
                                          char* candidates,
                                          std::size_t candidates_size,
                                          int* page_no,
                                          int* is_last_page) {
  if (preedit == nullptr || preedit_size == 0 || candidates == nullptr ||
      candidates_size == 0 || page_no == nullptr || is_last_page == nullptr) {
    return -1;
  }
  std::lock_guard<std::mutex> lock(g_mutex);
  RIME_STRUCT(RimeContext, context);
  const RimeApi* api = rime_get_api();
  if (!g_initialized || session == 0 || !api->get_context(session, &context)) {
    preedit[0] = '\0';
    candidates[0] = '\0';
    *page_no = 0;
    *is_last_page = 1;
    return -2;
  }
  const std::string preedit_value =
      context.composition.preedit == nullptr ? "" : context.composition.preedit;
  std::string candidate_value;
  for (int i = 0; i < context.menu.num_candidates; ++i) {
    const char* text = context.menu.candidates[i].text;
    if (text == nullptr) {
      continue;
    }
    if (!candidate_value.empty()) {
      candidate_value.push_back('\n');
    }
    candidate_value.append(text);
  }
  const int page_no_value = context.menu.page_no;
  const int is_last_page_value = context.menu.is_last_page ? 1 : 0;
  api->free_context(&context);
  if (!copy_result(preedit_value, preedit, preedit_size) ||
      !copy_result(candidate_value, candidates, candidates_size)) {
    preedit[0] = '\0';
    candidates[0] = '\0';
    *page_no = 0;
    *is_last_page = 1;
    return -3;
  }
  *page_no = page_no_value;
  *is_last_page = is_last_page_value;
  return 1;
}

FEELIME_EXPORT int feelime_rime_get_commit(std::uintptr_t session,
                                         char* output,
                                         std::size_t output_size) {
  std::lock_guard<std::mutex> lock(g_mutex);
  RIME_STRUCT(RimeCommit, commit);
  const RimeApi* api = rime_get_api();
  if (!g_initialized || session == 0 || !api->get_commit(session, &commit)) {
    if (output != nullptr && output_size > 0) {
      output[0] = '\0';
    }
    return 0;
  }
  const std::string value = commit.text == nullptr ? "" : commit.text;
  api->free_commit(&commit);
  return copy_result(value, output, output_size) ? 1 : -1;
}

FEELIME_EXPORT void feelime_rime_destroy_session(std::uintptr_t session) {
  std::lock_guard<std::mutex> lock(g_mutex);
  if (g_initialized && session != 0) {
    rime_get_api()->destroy_session(session);
  }
}

FEELIME_EXPORT void feelime_rime_finalize() {
  std::lock_guard<std::mutex> lock(g_mutex);
  if (g_initialized) {
    rime_get_api()->finalize();
    g_initialized = false;
  }
}
