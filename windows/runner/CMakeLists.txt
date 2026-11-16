cmake_minimum_required(VERSION 3.14)
project(watchvibe LANGUAGES CXX)

set(BINARY_NAME "watchvibe")

cmake_policy(SET CMP0079 NEW)

# Configure build options.
get_filename_component(WINDOWS_WRAPPER_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../" ABSOLUTE)
set(INSTALL_BUNDLE_DATA_DIR "${CMAKE_INSTALL_PREFIX}/data")
set(INSTALL_BUNDLE_LIB_DIR "${CMAKE_INSTALL_PREFIX}")

# Add application sources
add_executable(${BINARY_NAME} WIN32
  "main.cpp"
  "flutter_window.cpp"
  "run_loop.cpp"
  "utils.cpp"
)

# Apply default Windows definitions and compile options
apply_standard_settings(${BINARY_NAME})
target_compile_definitions(${BINARY_NAME} PRIVATE
  "NOMINMAX"
  "UNICODE"
  "_UNICODE"
)
