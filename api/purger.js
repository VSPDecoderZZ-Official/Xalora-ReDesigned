const fetch = require("node-fetch");
const settings = require("../settings.json");

module.exports.load = async function (app, db) {
  app.post("/api/purge", async (req, res) => {
    if (!req.session.pterodactyl) return res.redirect("/login");

    const keyword = req.body.keyword; // Get keyword from request body

    try {
      const cacheaccount = await fetch(
        `${settings.pterodactyl.domain}/api/application/users/${req.session.pterodactyl.id}?include=servers`,
        {
          method: "get",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${settings.pterodactyl.key}`,
          },
        }
      );

      if (cacheaccount.statusText === "Not Found") {
        return res.json({ success: false, message: alerts.INVALIDUSER });
      }

      const cacheaccountinfo = await cacheaccount.json();
      req.session.pterodactyl = cacheaccountinfo.attributes;

      if (!cacheaccountinfo.attributes.root_admin) {
        return res.json({ success: false, message: alerts.NOTANADMIN });
      }

      const response = await fetch(`${settings.pterodactyl.domain}/api/application/servers`, {
        headers: {
          Authorization: `Bearer ${settings.pterodactyl.key}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get server list: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const servers = data.data;

      // Filter servers that do not include the specified keyword
      const serversToDelete = servers.filter(
        (server) => !server.attributes.name.includes(keyword)
      );

      for (const server of serversToDelete) {
        try {
          const serverId = server.attributes.id;
          const serverName = server.attributes.name;

          const deleteResponse = await fetch(
            `${settings.pterodactyl.domain}/api/application/servers/${serverId}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${settings.pterodactyl.key}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (deleteResponse.ok) {
            console.log(`Server ${serverName} deleted successfully.`);
          } else {
            console.error(`Failed to delete server ${serverName}: ${deleteResponse.status} ${deleteResponse.statusText}`);
          }
        } catch (error) {
          console.error(`Failed to delete server ${server.attributes.name}: ${error.message}`);
        }
      }

      console.log("Purging complete.");
      res.sendStatus(200);
    } catch (error) {
      console.error(`Error during purge: ${error.message}`);
      res.status(500).json({ success: false, message: "Server error occurred." });
    }
  });
};
