const NodeHelper = require("node_helper");
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 86400 });

module.exports = NodeHelper.create({
    start: function() {
        console.log("Node helper started for MMM-LittleBockFermentationLog");
    },

    socketNotificationReceived: async function(notification, payload) {
        console.log("Notification received:", notification);
        try {
            if (notification === "MMM-LittleBockFermentationLog_GET_FERMENTATION_DATA") {
                this.config = payload;
                const apiUrl = `${this.config.apiUrl}/fermentation_logs?brewSession=${this.config.brewSessionID}`;
                const data = await this.getDataFromCacheOrFetch(apiUrl);
                this.sendSocketNotification("MMM-LittleBockFermentationLog_FERMENTATION_DATA_RESULT", data);
            }
    
            if (notification === "MMM-LittleBockFermentationLog_GET_RECIPE_DATA") {
                this.config = payload;
                const brewSessionUrl = `${this.config.apiUrl}/brew_sessions/${this.config.brewSessionID}`;
                const recipeData = await this.getRecipeDataFromCacheOrFetch(brewSessionUrl);
                this.sendSocketNotification("MMM-LittleBockFermentationLog_RECIPE_DATA_RESULT", recipeData);
            }
        } catch (error) {
            console.error("Error processing notification:", error);
            if (notification === "MMM-LittleBockFermentationLog_GET_FERMENTATION_DATA") {
                this.sendSocketNotification("MMM-LittleBockFermentationLog_FERMENTATION_DATA_RESULT", []);
            } else if (notification === "MMM-LittleBockFermentationLog_GET_RECIPE_DATA") {
                this.sendSocketNotification("MMM-LittleBockFermentationLog_RECIPE_DATA_RESULT", {});
            }
        }
    },
    
    async fetchAllData(url) {
        const allData = [];
        let page = 1;
    
        const fetchPage = async (page) => {
            console.log(`Fetching page ${page}...`);
            const response = await fetch(`${url}&page=${page}`, {
                headers: {
                    "X-AUTH-TOKEN": this.config.apiToken
                }
            });
    
            const data = await response.json();
            if (data && data['hydra:member']) {
                allData.push(...data['hydra:member']);
                if (data['hydra:view'] && data['hydra:view']['hydra:next']) {
                    return fetchPage(page + 1);
                } else {
                    cache.set(url, allData);
                    cache.set('lastPage', page);
                    console.log("All data fetched and cached.");
                    return allData;
                }
            } else {
                console.warn(`No data on page ${page}`);
                return allData;
            }
        };
        return fetchPage(page);
    },
    
    async checkForNewPages(url, cachedData) {
        const lastPage = cache.get('lastPage') || 1;
        const nextPage = lastPage + 1;
        const response = await fetch(`${url}&page=${nextPage}`, {
            headers: {
                "X-AUTH-TOKEN": this.config.apiToken
            }
        });
        const data = await response.json();
        if (data['hydra:member'] && data['hydra:member'].length > 0) {
            cachedData.push(...data['hydra:member']);
            cache.set(url, cachedData);
            cache.set('lastPage', nextPage);
            console.log(`Page ${nextPage} added to cache.`);
        } else {
            console.log("No new pages found.");
        }
        return cachedData;
    },

    async checkForUpdatesOnLastPage(url, cachedData) {
        const lastPage = cache.get('lastPage') || 1;
        const response = await fetch(`${url}&page=${lastPage}`, {
            headers: {
                "X-AUTH-TOKEN": this.config.apiToken
            }
        });
    
        if (!response.ok) {
            console.error(`Failed to fetch last page (${lastPage}): ${response.statusText}`);
            return cachedData;
        }
    
        const data = await response.json();
        if (data['hydra:member'] && data['hydra:member'].length > cachedData.length) {
            console.log("New data found on the last page, updating cache...");
            
            const newEntries = data['hydra:member'].slice(cachedData.length); 
            cachedData.push(...newEntries);
            
            cache.set(url, cachedData);
            console.log("Cache updated with new entries from the last page.");
        } else {
            console.log("No new data found on the last page.");
        }
    
        return cachedData;
    },   

    async getDataFromCacheOrFetch(url) {
        const cachedData = cache.get(url);
        if (cachedData) {
            console.log("Checking last page for new data...");
            const updatedData = await this.checkForUpdatesOnLastPage(url, cachedData);
            return this.checkForNewPages(url, updatedData); 
        } else {
            console.log("Cache expired or missing, fetching all data...");
            return this.fetchAllData(url);
        }
    },
    
    getRecipeDataFromCacheOrFetch(brewSessionUrl) {
        const cachedRecipeData = cache.get(brewSessionUrl);
        if (cachedRecipeData) {
            console.log("Using cached data for recipe information.");
            return cachedRecipeData;
        } else {
            console.log("Cache expired or missing, fetching new recipe data...");
            return this.fetchBrewSessionData(brewSessionUrl);
        }
    },

    async fetchBrewSessionData(brewSessionUrl) {
        try {
            const response = await fetch(brewSessionUrl, {
                headers: {
                    "X-AUTH-TOKEN": this.config.apiToken
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch brew session data: ${response.statusText}`);
            }

            const sessionData = await response.json();
            if (sessionData.brewSessionRecipe && sessionData.brewSessionRecipe["@id"]) {
                const recipeUrl = sessionData.brewSessionRecipe["@id"];
                return this.fetchRecipeData(recipeUrl, brewSessionUrl);
            } else {
                console.warn("Brew session recipe not found in session data.");
                return {};
            }
        } catch (error) {
            console.error("Error fetching brew session data:", error);
            return {};
        }
    },

    async fetchRecipeData(recipeUrl, brewSessionUrl) {
        try {
            const response = await fetch(`https://www.littlebock.fr${recipeUrl}`, {
                headers: {
                    "X-AUTH-TOKEN": this.config.apiToken
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch recipe data: ${response.statusText}`);
            }

            const recipeData = await response.json();
            const recipeInfo = {
                name: recipeData.name,
                estOG: recipeData.estOG,
                estFG: recipeData.estFG
            };

            cache.set(brewSessionUrl, recipeInfo);
            console.log("Recipe data fetched and cached.");
            return recipeInfo;
        } catch (error) {
            console.error("Error fetching recipe data:", error);
            return {};
        }
    }
});
