import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { cancelCurrent } from './store/actions';
import { useUI } from './store/ui';

export const isNative = () => Capacitor.isNativePlatform();

/** Android WebViews ignore <a download>; write the file and hand it to the share sheet instead. */
export async function saveFileNative(filename: string, contents: string) {
  const { uri } = await Filesystem.writeFile({ path: filename, data: contents, directory: Directory.Cache, encoding: Encoding.UTF8 });
  await Share.share({ title: 'Family tree backup', text: 'Family 3D tree backup — open it with Import.', files: [uri], dialogTitle: 'Save your family tree' });
}

/** Hardware back button: close whatever is open first; exit only from the plain tree view. */
export function setupNative() {
  if (!isNative()) return;
  void App.addListener('backButton', () => {
    const { mode, selectedId, dialog, setDialog } = useUI.getState();
    if (dialog) return setDialog(null);
    if (mode.kind !== 'idle' || selectedId) return cancelCurrent();
    void App.exitApp();
  });
}
