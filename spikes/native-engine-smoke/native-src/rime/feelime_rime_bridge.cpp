// Feelime's original bounded C ABI for the isolated Android feasibility spike.
// librime itself is built without source changes from the pinned upstream tree.

#include <rime_api.h>

// #103 preedit 光标：rime_api 公开层只有裸 set_caret_pos（不带编辑语
// 义）；移动必须先 Context::BeginEditing()（host probe 实测：跳过它，
// 中置退格会走 ReopenPreviousSelection 变成撤销选词而非删输入码——
// editor.cc 的 RevertLastEdit 顺序所致）。与 rime_api_impl.h 的做法一
// 致：经 Service::instance().GetSession 取 Context 直调内部方法。
// context.h 给 Context 完整定义（service.h 只前置声明）。
#include <rime/context.h>
#include <rime/service.h>

#include <algorithm>
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
         api->is_maintenance_mode != nullptr &&
         // #72 预加载定罪（2026-10-27）：候选浏览必须走不移动高亮的
         // 只读迭代器（PAGE_DOWN 会拖 selector 高亮，污染 stable-seg
         // hint 的取材候选）。绝对下标的选/删接口同理替换 seek+翻页。
         api->candidate_list_from_index != nullptr &&
         api->candidate_list_next != nullptr &&
         api->candidate_list_end != nullptr &&
         api->select_candidate != nullptr &&
         api->delete_candidate != nullptr;
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
  // 2 = ERROR 及以上：release 构建的 native stderr 是 /dev/null，INFO
  // 级无通路只剩字符串格式化开销，收紧到 2。.dev 取证需要 deployer
  // 日志时临时改 0 重编（debuggable 构建的 stderr 会转发进 logcat，
  // #23 真机定罪即此路径）。
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

// 绝对下标（整个候选列表的平铺序号，与 candidate_list_from_index 的
// iterator.index 同域）。候选浏览/深页点选不再靠 seek 翻页 + 页内下标。
FEELIME_EXPORT int feelime_rime_select_candidate_absolute(
    std::uintptr_t session, std::size_t index) {
  std::lock_guard<std::mutex> lock(g_mutex);
  return g_initialized && session != 0 &&
         rime_get_api()->select_candidate(session, index);
}

FEELIME_EXPORT int feelime_rime_delete_candidate_absolute(
    std::uintptr_t session, std::size_t index) {
  std::lock_guard<std::mutex> lock(g_mutex);
  return g_initialized && session != 0 &&
         rime_get_api()->delete_candidate(session, index);
}

// 只读取第 view_page 页候选：candidate_list_from_index 起步、next 推进
// pageSize+1 次（末次只判 hasNext）。全程不动 selector 高亮、不发键、
// 不收割 commit——预加载从此无副作用（#72 nihlk 第 5 帧病态根因）。
// 返回：0 成功（含「有 preedit、无候选」的合法空页）；-1 参数；
// -2 引擎/会话不可用；-3 缓冲不足；-4 页越界/空页（PAGE_BOUNDARY，
// 调用方应保留当前页）。page_no 回填 view_page，is_last_page=无下一页。
FEELIME_EXPORT int feelime_rime_context_at_page(std::uintptr_t session,
                                                int view_page,
                                                char* preedit,
                                                std::size_t preedit_size,
                                                char* candidates,
                                                std::size_t candidates_size,
                                                int* page_no,
                                                int* is_last_page,
                                                int* has_next,
                                                int* page_size_out,
                                                int* preedit_caret) {
  if (preedit == nullptr || preedit_size == 0 || candidates == nullptr ||
      candidates_size == 0 || page_no == nullptr || is_last_page == nullptr ||
      has_next == nullptr || page_size_out == nullptr ||
      preedit_caret == nullptr) {
    return -1;
  }
  if (view_page < 0) {
    return -4;
  }
  std::lock_guard<std::mutex> lock(g_mutex);
  const RimeApi* api = rime_get_api();
  if (!g_initialized || session == 0 || api == nullptr) {
    return -2;
  }
  RIME_STRUCT(RimeContext, context);
  if (!api->get_context(session, &context)) {
    return -2;
  }
  const int page_size = context.menu.page_size;
  *page_size_out = page_size;
  // #103 显示域光标：RimeComposition.cursor_pos = preedit 显示串内的
  // UTF-8 字节位置（已确认汉字前缀/T9 转写都会与 raw 域错位，两个域
  // 分开传，UTF-16 换算在 JNI 层做）。
  *preedit_caret = context.composition.cursor_pos;
  const std::string preedit_value =
      context.composition.preedit == nullptr ? "" : context.composition.preedit;
  api->free_context(&context);
  // 组合态与候选页分开处理（codex 四轮 P1）：有输入、无候选（如全拼单
  // 字母 i/u/v，menu 为空、page_size<=0）是合法状态——preedit 照抄、候
  // 选为空，不算错误。只有复制失败才是 -3。
  if (page_size <= 0) {
    if (!copy_result(preedit_value, preedit, preedit_size) ||
        !copy_result(std::string(), candidates, candidates_size)) {
      return -3;
    }
    *page_no = view_page;
    *is_last_page = 1;
    *has_next = 0;
    return 0;
  }
  RimeCandidateListIterator iterator = {};
  if (!api->candidate_list_from_index(session, &iterator,
                                      view_page * page_size)) {
    return -4;
  }
  std::string candidate_value;
  bool page_empty = true;
  for (int i = 0; i < page_size; ++i) {
    if (!api->candidate_list_next(&iterator)) {
      break;
    }
    page_empty = false;
    if (i > 0) {
      candidate_value.push_back('\n');
    }
    // null 文本也占一个绝对下标位：保留空行对齐，调用方按下标寻址。
    const char* text = iterator.candidate.text;
    if (text != nullptr) {
      candidate_value.append(text);
    }
  }
  const bool more = api->candidate_list_next(&iterator);
  api->candidate_list_end(&iterator);
  if (page_empty) {
    return -4;
  }
  if (!copy_result(preedit_value, preedit, preedit_size) ||
      !copy_result(candidate_value, candidates, candidates_size)) {
    return -3;
  }
  *page_no = view_page;
  *is_last_page = more ? 0 : 1;
  *has_next = more ? 1 : 0;
  return 0;
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

// ---- #103 preedit 光标（组合内定位，issue #103）----

// raw 输入域快照：一次锁内取完整原始输入码（ASCII，如 "nihaoma"/
// "6442662"）与其 caret 位置。显示域光标走 context_at_page 的
// preedit_caret 出参；两域必须同批读取（组合态下两者会错位）。
// 返回：0 成功；-1 参数；-2 引擎/会话不可用。
FEELIME_EXPORT int feelime_rime_caret_snapshot(std::uintptr_t session,
                                               char* input,
                                               std::size_t input_size,
                                               int* input_caret) {
  if (input == nullptr || input_size == 0 || input_caret == nullptr) {
    return -1;
  }
  std::lock_guard<std::mutex> lock(g_mutex);
  const RimeApi* api = rime_get_api();
  if (!g_initialized || session == 0 || api == nullptr) {
    return -2;
  }
  // get_input 返回的指针在编辑后失效——锁内立即拷贝。
  const char* raw = api->get_input(session);
  const std::string value = raw == nullptr ? "" : raw;
  *input_caret = static_cast<int>(api->get_caret_pos(session));
  return copy_result(value, input, input_size) ? 0 : -3;
}

// 原子批次移动 raw 光标（#103 空格横滑）：target = clamp(caret+steps,
// 0, input.length())；无位移直接完成（不触发 Compose 重算——纯定位
// 帧不得污染 #72 的 hint 快照与候选代数）；有位移先 BeginEditing 再
// set_caret_pos（同步触发一次 Compose：重算分段/候选是设计内行为）。
// JNI 侧同方向批次合并、反方向保序（见 Kotlin applyScrub 语义）。
// *moved：0=无位移（已在边界）1=已移动。返回：0 成功；-1 参数；
// -2 引擎/会话不可用。
FEELIME_EXPORT int feelime_rime_move_caret(std::uintptr_t session,
                                           int steps,
                                           int* moved) {
  if (moved == nullptr) {
    return -1;
  }
  std::lock_guard<std::mutex> lock(g_mutex);
  if (!g_initialized || session == 0) {
    return -2;
  }
  const rime::an<rime::Session> rime_session =
      rime::Service::instance().GetSession(session);
  rime::Context* ctx =
      rime_session ? rime_session->context() : nullptr;
  if (ctx == nullptr) {
    return -2;
  }
  const std::size_t caret = ctx->caret_pos();
  const std::size_t length = ctx->input().size();
  std::size_t target;
  if (steps < 0) {
    const std::size_t back = static_cast<std::size_t>(-(long long)steps);
    target = caret > back ? caret - back : 0;
  } else {
    target = std::min(caret + static_cast<std::size_t>(steps), length);
  }
  if (target == caret) {
    *moved = 0;
    return 0;
  }
  ctx->BeginEditing();
  ctx->set_caret_pos(target);
  *moved = 1;
  return 0;
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
