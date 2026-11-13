cmake_minimum_required(VERSION 3.22)
project(feelime_rime LANGUAGES C CXX)

option(FEELIME_HOST_DEPLOYER "Build the pinned host rime_deployer" OFF)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)
set(CMAKE_MODULE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/cmake")

if(FEELIME_HOST_DEPLOYER)
  set(BUILD_SHARED_LIBS ON CACHE BOOL "" FORCE)
else()
  set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
endif()
set(BUILD_TESTING OFF CACHE BOOL "" FORCE)
set(BUILD_TEST OFF CACHE BOOL "" FORCE)
set(BUILD_STATIC ON CACHE BOOL "" FORCE)
set(BUILD_DATA OFF CACHE BOOL "" FORCE)
set(BUILD_SAMPLE OFF CACHE BOOL "" FORCE)
set(BUILD_SEPARATE_LIBS OFF CACHE BOOL "" FORCE)
set(ENABLE_EXTERNAL_PLUGINS OFF CACHE BOOL "" FORCE)
set(ENABLE_TIMESTAMP OFF CACHE BOOL "" FORCE)
set(WITH_GFLAGS OFF CACHE BOOL "" FORCE)
set(WITH_GTEST OFF CACHE BOOL "" FORCE)
set(WITH_UNWIND none CACHE STRING "" FORCE)
set(YAML_CPP_BUILD_CONTRIB OFF CACHE BOOL "" FORCE)
set(YAML_CPP_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(YAML_CPP_BUILD_TOOLS OFF CACHE BOOL "" FORCE)
set(YAML_CPP_INSTALL OFF CACHE BOOL "" FORCE)
set(LEVELDB_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(LEVELDB_BUILD_BENCHMARKS OFF CACHE BOOL "" FORCE)
set(LEVELDB_INSTALL OFF CACHE BOOL "" FORCE)
set(OPENCC_ENABLE_INSTALL OFF CACHE BOOL "" FORCE)
set(ENABLE_GTEST OFF CACHE BOOL "" FORCE)
set(ENABLE_BENCHMARK OFF CACHE BOOL "" FORCE)
set(BUILD_DOCUMENTATION OFF CACHE BOOL "" FORCE)
set(BUILD_OPENCC_JIEBA_PLUGIN OFF CACHE BOOL "" FORCE)
set(USE_SYSTEM_MARISA ON CACHE BOOL "" FORCE)
set(LIBMARISA marisa CACHE STRING "Prebuilt in the same CMake graph" FORCE)

set(BOOST_INCLUDE_LIBRARIES algorithm crc dll interprocess range regex scope_exit signals2 utility uuid)
add_subdirectory(boost EXCLUDE_FROM_ALL)
add_subdirectory(librime/deps/glog EXCLUDE_FROM_ALL)
add_subdirectory(librime/deps/yaml-cpp EXCLUDE_FROM_ALL)
add_subdirectory(librime/deps/leveldb EXCLUDE_FROM_ALL)
add_subdirectory(librime/deps/marisa-trie EXCLUDE_FROM_ALL)
add_subdirectory(librime/deps/opencc EXCLUDE_FROM_ALL)
file(GLOB FEELIME_OPENCC_HEADERS "${CMAKE_CURRENT_SOURCE_DIR}/librime/deps/opencc/src/*.hpp")
file(COPY ${FEELIME_OPENCC_HEADERS} DESTINATION "${CMAKE_BINARY_DIR}/opencc-include/opencc")

set(X11Keysym "${CMAKE_CURRENT_SOURCE_DIR}/librime/include")
add_subdirectory(librime EXCLUDE_FROM_ALL)

if(NOT FEELIME_HOST_DEPLOYER)
  add_library(feelime_rime SHARED feelime_rime_bridge.cpp)
  target_include_directories(feelime_rime PRIVATE
    librime/src librime/include
    # #103 bridge 直调 Context 内部方法（BeginEditing/set_caret_pos），
    # 内部头链引 common.h -> <rime/build_config.h>（configure 期生成，
    # 住在 librime 的 PROJECT_BINARY_DIR/src）——directory-level 的
    # include_directories 不进 rime-static 的 INTERFACE，这里显式补：
    # rime-static 定义于 librime/src/CMakeLists.txt，其 BINARY_DIR 即
    # <librime-bin>/src，生成头 rime/build_config.h 相对它解析。
    $<TARGET_PROPERTY:rime-static,BINARY_DIR>)
  # common.h -> boost/signals2/...：librime 用 find_package(Boost) 的
  # 聚合 include（每库源目录 include/，不随 rime-static 的 usage 传递），
  # bridge 照抄同一调用拿同一路径集。
  find_package(Boost 1.77.0)
  target_include_directories(feelime_rime PRIVATE ${Boost_INCLUDE_DIRS})
  target_link_libraries(feelime_rime PRIVATE rime-static log android)
  target_link_options(feelime_rime PRIVATE "LINKER:-z,max-page-size=16384")
endif()
