# Embed a multi-resolution Windows icon in the portable Electron executable.
import ctypes
from ctypes import wintypes
from pathlib import Path
import struct
import sys

kernel = ctypes.WinDLL('kernel32', use_last_error=True)

def api(name, result, *arguments):
    function = getattr(kernel, name)
    function.argtypes = arguments
    function.restype = result
    return function

handle = wintypes.HANDLE
ptr = ctypes.c_void_p
load = api('LoadLibraryExW', handle, wintypes.LPCWSTR, handle, wintypes.DWORD)
free = api('FreeLibrary', wintypes.BOOL, handle)
callback = ctypes.WINFUNCTYPE(wintypes.BOOL, handle, ptr, ptr, wintypes.WORD, ctypes.c_ssize_t)
languages = api('EnumResourceLanguagesW', wintypes.BOOL, handle, ptr, ptr, callback, ctypes.c_ssize_t)
names_callback = ctypes.WINFUNCTYPE(wintypes.BOOL, handle, ptr, ptr, ctypes.c_ssize_t)
names = api('EnumResourceNamesW', wintypes.BOOL, handle, ptr, names_callback, ctypes.c_ssize_t)
begin = api('BeginUpdateResourceW', handle, wintypes.LPCWSTR, wintypes.BOOL)
update = api('UpdateResourceW', wintypes.BOOL, handle, ptr, ptr, wintypes.WORD, ptr, wintypes.DWORD)
end = api('EndUpdateResourceW', wintypes.BOOL, handle, wintypes.BOOL)

def checked(result):
    if not result:
        raise ctypes.WinError(ctypes.get_last_error())
    return result

def icon_groups(executable):
    groups = []
    module = checked(load(str(executable), None, 2))
    @callback
    def language_found(module, kind, name, language, parameter):
        groups.append((name, language))
        return True
    @names_callback
    def name_found(module, kind, name, parameter):
        if name > 65535:
            return True
        return languages(module, kind, name, language_found, 0)
    try:
        checked(names(module, 14, name_found, 0))
    finally:
        free(module)
    if not groups:
        raise ValueError('No Windows icon group found')
    return groups

def embed(executable, icon):
    data = icon.read_bytes()
    count = struct.unpack_from('<H', data, 4)[0]
    group = bytearray(data[:6])
    images = []
    for index in range(count):
        offset = 6 + index * 16
        size, start = struct.unpack_from('<II', data, offset + 8)
        image_id = 4000 + index
        images.append((image_id, data[start:start + size]))
        group.extend(data[offset:offset + 12] + struct.pack('<H', image_id))
    groups = icon_groups(executable)
    transaction = checked(begin(str(executable), False))
    try:
        for language in {language for _, language in groups}:
            for image_id, image in images:
                checked(update(transaction, 3, image_id, language, image, len(image)))
        for name, language in groups:
            checked(update(transaction, 14, name, language, bytes(group), len(group)))
    except BaseException:
        end(transaction, True)
        raise
    checked(end(transaction, False))

if __name__ == '__main__':
    embed(Path(sys.argv[1]).resolve(), Path(sys.argv[2]))
