import { contextBridge } from 'electron';

const apiBase = process.env.GXL_DESKTOP_API || '';

contextBridge.exposeInMainWorld('__GXL_BRIDGE__', {
  apiBase
});
