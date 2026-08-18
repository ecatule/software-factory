const neo4j = require("neo4j-driver");
(async () => {
  const driver = neo4j.driver("bolt://localhost:7687", neo4j.auth.basic("neo4j", "neo4j123"));
  const session = driver.session();
  try {
    const repos = await session.run("MATCH (r:Repository) RETURN r.id AS id, r.name AS name");
    console.log("Repositories:", repos.records.map(r => r.get("id")));
    const screens = await session.run("MATCH (s:Screen) RETURN s.id AS id, s.name AS name, s.filePath AS filePath");
    console.log("Screens:", screens.records.map(r => ({ name: r.get("name"), filePath: r.get("filePath") })));
  } finally {
    await session.close();
    await driver.close();
  }
})();
