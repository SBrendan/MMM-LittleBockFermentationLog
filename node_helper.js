const NodeHelper = require("node_helper");
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 86400 }); 

module.exports = NodeHelper.create({
    start: function() {
        console.log("Node helper started for MMM-LittleBockFermentationLog");
    },

    socketNotificationReceived: function(notification, payload) {
        console.log("Notification received:", notification);
        if (notification === "MMM-LittleBockFermentationLog_GET_FERMENTATION_DATA") {
            this.config = payload;
            const apiUrl = `${this.config.apiUrl}/fermentation_logs?brewSession=${this.config.brewSessionID}`;
            this.getDataFromCacheOrFetch(apiUrl)
                .then(data => {
                    this.sendSocketNotification("MMM-LittleBockFermentationLog_FERMENTATION_DATA_RESULT", data);
                })
                .catch(error => console.error("Error fetching data:", error));
        }

        if (notification === "MMM-LittleBockFermentationLog_GET_RECIPE_DATA") {
            this.config = payload;
            const brewSessionUrl = `${this.config.apiUrl}/brew_sessions/${this.config.brewSessionID}`;
            this.getRecipeDataFromCacheOrFetch(brewSessionUrl);
        }
    },

    async fetchAllData(url) {
        const allData = [];
        let page = 1;
        let lastPage = null;
    
        const fetchPage = async (page) => {
            console.log(`Fetching page ${page}...`);
            const response = await fetch(`${url}&page=${page}`, {
                headers: {
                    "X-AUTH-TOKEN": this.config.apiToken
                }
            });
            const data = await response.json();
            allData.push(...data['hydra:member']);
    
            if (data['hydra:view'] && data['hydra:view']['hydra:next']) {
                page += 1;
                await fetchPage(page);
                return allData; 
            } else {
                lastPage = page; 
                cache.set('lastPage', lastPage);
                cache.set(url, allData); 
                console.log("All data fetched and cached.");
                return allData;
            }
        };
    
        return fetchPage(page);
    },
    
    getDataFromCacheOrFetch(url) {
        const cachedData = cache.get(url);
        if (cachedData) {
            console.log("Using cached data for fermentation logs.");
            return this.checkForNewPages(url, cachedData); 
        } else {
            console.log("Cache expired or missing, fetching all data...");
            return this.fetchAllData(url);
        }
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
            console.log(`New page ${nextPage} detected, updating cache...`);
            cachedData.push(...data['hydra:member']);
            cache.set(url, cachedData); 
            cache.set('lastPage', nextPage); 
        } else {
            console.log("No new pages found.");
        }
    
        return cachedData;
    },

    getRecipeDataFromCacheOrFetch(brewSessionUrl) {
        const cachedRecipeData = cache.get(brewSessionUrl);
        if (cachedRecipeData) {
            console.log("Using cached data for recipe information.");
            this.sendSocketNotification("MMM-LittleBockFermentationLog_RECIPE_DATA_RESULT", cachedRecipeData);
        } else {
            console.log("Cache expired or missing, fetching new recipe data...");
            this.fetchBrewSessionData(brewSessionUrl);
        }
    },

    async fetchBrewSessionData(brewSessionUrl) {
        try {
            const response = await fetch(brewSessionUrl, {
                headers: {
                    "X-AUTH-TOKEN": this.config.apiToken
                }
            });
            const sessionData = await response.json();
            const recipeUrl = sessionData.brewSessionRecipe["@id"];
            
            
            this.fetchRecipeData(recipeUrl, brewSessionUrl);
        } catch (error) {
            console.error("Error fetching brew session data:", error);
        }
    },

    async fetchRecipeData(recipeUrl, brewSessionUrl) {
        try {
            const response = await fetch(`https://www.littlebock.fr${recipeUrl}`, {
                headers: {
                    "X-AUTH-TOKEN": this.config.apiToken
                }
            });
            const recipeData = await response.json();

            
            const recipeInfo = {
                name: recipeData.name,
                estOG: recipeData.estOG,
                estFG: recipeData.estFG
            };

            
            cache.set(brewSessionUrl, recipeInfo);
            console.log("Recipe data fetched and cached.");

            
            this.sendSocketNotification("MMM-LittleBockFermentationLog_RECIPE_DATA_RESULT", recipeInfo);
        } catch (error) {
            console.error("Error fetching recipe data:", error);
        }
    }
});
