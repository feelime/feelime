/* A/B 词库评测探针（issue：rime-ice vs rime-frost vs luna 基线）。
 * 读 cases.tsv（每行：拼音<TAB>期望首选，期望可用 | 分隔多个可接受文本），
 * 逐键 simulate 后取候选条，统计首选命中 / 前三命中。跑完输出明细与汇总。
 * 全新 user_dir 跑（无用户词典学习效应），三套词库同一 librime 同一 schema。
 */
#include <rime_api.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

static RimeApi* api;

static int in_expected(const char* text, char* expected) {
    // expected 用 | 分隔，命中任意一个即算
    char* save = NULL;
    for (char* part = strtok_r(expected, "|", &save); part;
         part = strtok_r(NULL, "|", &save)) {
        if (strcmp(text, part) == 0) return 1;
    }
    return 0;
}

int main(int argc, char** argv) {
    if (argc < 4) {
        fprintf(stderr, "usage: %s <cases.tsv> <shared_dir> <user_dir>\n", argv[0]);
        return 2;
    }
    RIME_STRUCT(RimeTraits, traits);
    traits.app_name = "rime.dict-ab";
    traits.shared_data_dir = argv[2];
    traits.user_data_dir = argv[3];
    traits.prebuilt_data_dir = argv[2];
    traits.staging_dir = argv[3];
    api = rime_get_api();
    struct timespec t0, t1;
    clock_gettime(CLOCK_MONOTONIC, &t0);
    api->initialize(&traits);
    clock_gettime(CLOCK_MONOTONIC, &t1);
    double init_ms = (t1.tv_sec - t0.tv_sec) * 1000.0 + (t1.tv_nsec - t0.tv_nsec) / 1e6;

    RimeSessionId s = api->create_session();
    if (!s || !api->select_schema(s, "luna_pinyin")) {
        fprintf(stderr, "session/schema failed\n");
        return 1;
    }

    FILE* f = fopen(argv[1], "r");
    if (!f) { perror("cases"); return 2; }
    char line[512];
    int total = 0, hit1 = 0, hit3 = 0;
    double query_ms = 0;
    while (fgets(line, sizeof line, f)) {
        char* nl = strpbrk(line, "\r\n"); if (nl) *nl = 0;
        if (!line[0] || line[0] == '#') continue;
        char* tab = strchr(line, '\t');
        if (!tab) continue;
        *tab = 0;
        char* py = line;
        char expected[256];
        strncpy(expected, tab + 1, sizeof expected - 1);
        expected[sizeof expected - 1] = 0;

        clock_gettime(CLOCK_MONOTONIC, &t0);
        for (const char* p = py; *p; p++) {
            if (*p == '\'') continue; // 避开分词符：让引擎自己切
            api->process_key(s, (int)*p, 0);
        }
        RIME_STRUCT(RimeContext, ctx);
        int got = api->get_context(s, &ctx);
        clock_gettime(CLOCK_MONOTONIC, &t1);
        query_ms += (t1.tv_sec - t0.tv_sec) * 1000.0 + (t1.tv_nsec - t0.tv_nsec) / 1e6;
        total++;
        const char* c0 = got && ctx.menu.num_candidates > 0 ? ctx.menu.candidates[0].text : "";
        int is1 = got && ctx.menu.num_candidates > 0 && in_expected(c0, expected);
        int is3 = is1;
        if (got && !is3) {
            for (int i = 0; i < ctx.menu.num_candidates && i < 3; i++) {
                char tmp[256];
                strncpy(tmp, tab + 1, sizeof tmp - 1); tmp[sizeof tmp - 1] = 0;
                if (in_expected(ctx.menu.candidates[i].text, tmp)) { is3 = 1; break; }
            }
        }
        if (is1) hit1++;
        if (is3) hit3++;
        else printf("MISS %s -> [%s] want %s\n", py, c0, tab + 1);
        if (got) api->free_context(&ctx);
        api->clear_composition(s);
    }
    fclose(f);
    printf("RESULT total=%d hit1=%d(%.1f%%) hit3=%d(%.1f%%) init=%.0fms query_avg=%.2fms\n",
           total, hit1, 100.0 * hit1 / total, hit3, 100.0 * hit3 / total,
           init_ms, query_ms / total);
    fflush(stdout);
    // 系统 librime 插件（octagram/lua）在 atexit 清理路径上会崩，跳过析构直接退
    _exit(0);
}
