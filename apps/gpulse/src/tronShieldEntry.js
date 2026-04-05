import { installMockInjectedProviderIsolation } from './utils/mockInjectedIsolation.js';

function reinstall() {
  installMockInjectedProviderIsolation();
}
reinstall();
queueMicrotask(reinstall);
setTimeout(reinstall, 0);
setTimeout(reinstall, 120);
