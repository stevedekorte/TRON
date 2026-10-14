# tests

unit contains Node *.test.js invariants; browser contains explicitly invoked Playwright scripts; fixtures holds reproducible input files. npm test discovers only unit/*.test.js, in sorted order. Legacy tests/* command wrappers remain supported; they are not discovered twice. Browser artifacts remain in test-results, not beside tests.
