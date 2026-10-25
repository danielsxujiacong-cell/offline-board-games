import { readFileSync } from "node:fs";
const read = (name) =>
  JSON.parse(
    readFileSync(new URL("../data/" + name + ".json", import.meta.url), "utf8"),
  );
export const data = {
  schemaVersion: 1,
  locations: read("locations"),
  characters: read("characters"),
  roles: read("roles"),
  plots: read("plots"),
  incidents: read("incidents"),
  actionCards: read("action-cards"),
  scripts: [
    read("scripts/the-first-script"),
    read("scripts/prevailing-secrecy"),
  ],
};
