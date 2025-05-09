# Release Notes

## [v1.0.0] - 2024-05-09

### Features & Improvements

- **Overlay Redesign:**  
  The statistics overlay is now centered and constrained to 50vw on large screens, with responsive full-width on smaller screens. This provides a cleaner, more focused stats display.

- **Side-by-Side Stats Tables:**  
  Hero and Villain statistics are now displayed in a side-by-side layout for easier comparison.

- **Sticky Table Headers:**  
  Table headers remain visible as you scroll, making it easier to interpret long lists of stats.

- **Bar-Row Visualization Restored:**  
  Each row now includes a two-tone bar:  
  - The total bar width is proportional to the highest number of plays in the table.  
  - The colored segment within the bar represents the number of wins, proportional to the total plays for that row.  
  - This visually communicates both popularity and win rate at a glance.

- **Default Sorting:**  
  Both tables now default to sorting by "Plays" in descending order, showing the most-played heroes and villains at the top.

- **Improved Table Sorting:**  
  Clicking table headers toggles sorting direction and updates the display accordingly.

- **Modal Popups:**  
  Hovering over a hero or villain name shows a modal with detailed matchup stats. Emergency rebuild logic ensures modals always display correct data.

- **Performance & Robustness:**  
  - Caching and fallback logic for modal data.  
  - Defensive code to handle missing or malformed data.  
  - Diagnostic logging for easier debugging.

### Bug Fixes

- Fixed an issue where bar-rows were not visible or did not accurately represent wins/losses.
- Fixed an issue where extra tables could appear after the main stats tables.
- Fixed villain table rendering and modal data population edge cases.
- Fixed overlay and table layout issues on different screen sizes.
