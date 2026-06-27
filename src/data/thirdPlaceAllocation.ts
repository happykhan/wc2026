// FIFA Round-of-32 allocation table for the eight third-placed teams.
// Keys are the alphabetically sorted groups whose third-placed teams advance.
// Values map the first-place slot in the fixture list to the allocated
// third-place slot for that matchup.
export const THIRD_PLACE_ASSIGNMENTS: Record<string, Record<string, string>> = {
  BDEFIJKL: { '1A': '3E', '1B': '3J', '1D': '3B', '1E': '3D', '1G': '3I', '1I': '3F', '1K': '3L', '1L': '3K' },
  BDEFGIKL: { '1A': '3E', '1B': '3G', '1D': '3B', '1E': '3D', '1G': '3I', '1I': '3F', '1K': '3L', '1L': '3K' },
  BDEFGIJL: { '1A': '3E', '1B': '3G', '1D': '3B', '1E': '3D', '1G': '3J', '1I': '3F', '1K': '3L', '1L': '3I' },
  BDEFGIJK: { '1A': '3E', '1B': '3G', '1D': '3B', '1E': '3D', '1G': '3J', '1I': '3F', '1K': '3I', '1L': '3K' },
  ABDEFGIL: { '1A': '3E', '1B': '3G', '1D': '3B', '1E': '3D', '1G': '3A', '1I': '3F', '1K': '3L', '1L': '3I' },
  ABDEFGIK: { '1A': '3E', '1B': '3G', '1D': '3B', '1E': '3D', '1G': '3A', '1I': '3F', '1K': '3I', '1L': '3K' },
  ABDEFGIJ: { '1A': '3E', '1B': '3G', '1D': '3B', '1E': '3D', '1G': '3A', '1I': '3F', '1K': '3I', '1L': '3J' },
  ABCDEFGI: { '1A': '3C', '1B': '3G', '1D': '3B', '1E': '3D', '1G': '3A', '1I': '3F', '1K': '3E', '1L': '3I' },
};
