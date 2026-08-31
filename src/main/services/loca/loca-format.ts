// Binary layout constants for the BG3 .loca localization format.
// Mirrors LSLib/LS/Localization.cs (LocaHeader, LocaEntry, LocaReader/LocaWriter).

// Bytes 'LOCA' as little-endian u32.
export const LOCA_SIGNATURE = 0x41434f4c

// LocaHeader layout (Pack=1): Signature u32, NumEntries u32, TextsOffset u32.
export const LOCA_HEADER_SIZE = 4 + 4 + 4 // = 12

// LocaEntry layout (Pack=1): Key[64], Version u16, Length u32.
// Length is the text byte count INCLUDING the trailing NUL terminator.
export const LOCA_KEY_SIZE = 64
export const LOCA_ENTRY_SIZE = LOCA_KEY_SIZE + 2 + 4 // = 70

// BG3 mods write version="1" on every entry; other values are not produced by the game.
export const DEFAULT_LOCA_VERSION = 1

export interface LocaEntry {
  key: string
  version: number
  text: string
}
