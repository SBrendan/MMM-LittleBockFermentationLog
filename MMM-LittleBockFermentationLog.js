
function domReady(selector) {
    return new Promise((resolve) => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (document.querySelector(selector)) {
                    observer.disconnect();
                    resolve();
                }
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    });
}

Module.register("MMM-LittleBockFermentationLog", {
    defaults: {
        moduleTitle: "Suivi de Fermentation",
        updateInterval: 60 * 60 * 1000,
        apiToken: "", 
        apiUrl: "https://www.littlebock.fr/api",
        brewSessionID: "",
        animationSpeed: 500,
        layout: "cardsOnly",  // "horizontal" or "cardsOnly"
        visible: true  
    },

    start () {
        this.brewData = [];
        this.recipeData = {};
        this.loaded = false;
        this.getDataFromLittleBockAPI();
        this.getReceipeDataFromLittleBockAPI();
        this.scheduleUpdate();

        if (!this.config.visible) {
            this.hidden = true
        }
    },

    getHeader () {
        if (this.loaded && this.recipeData.name) {
            return "Log fermentation pour recette " + this.recipeData.name;
        }
        return this.data.header;
    },
    
    getScripts: function() {
        return [
            "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/2.9.4/Chart.bundle.min.js"
        ];
    },

    getStyles() {
        return ["MMM-LittleBockFermentationLog.css"];
    },

    scheduleUpdate () {
        setInterval(() => {
            this.getDataFromLittleBockAPI();
        }, this.config.updateInterval);
    },

    getDataFromLittleBockAPI () {
        this.sendSocketNotification("MMM-LittleBockFermentationLog_GET_FERMENTATION_DATA", this.config);
    },

    getReceipeDataFromLittleBockAPI () {
        this.sendSocketNotification("MMM-LittleBockFermentationLog_GET_RECIPE_DATA", this.config);
    },

    socketNotificationReceived(notification, payload) {
        console.log("Notification received:", notification);
        if (notification === "MMM-LittleBockFermentationLog_FERMENTATION_DATA_RESULT") {
            this.brewData = payload;
            this.updateDom(this.config.animationSpeed);

            domReady('#fermentationChart').then(() => {
                this.renderChart();
            });
            this.loaded = true;
        }

        if (notification === "MMM-LittleBockFermentationLog_RECIPE_DATA_RESULT") {
            console.log(payload)
            this.recipeData = payload
            this.updateDom(this.config.animationSpeed);
            domReady('#fermentationChart').then(() => {
                this.renderChart();
            });
            this.loaded = true;
        }
    },


    getDom() {
        const wrapper = document.createElement("div");
        wrapper.className = "littlebock-container";
        
        if (!this.loaded || !this.brewData) {
            wrapper.innerHTML = "Chargement des données...";
            return wrapper;
        }
    
        
        if (this.brewData.length === 0) {
            wrapper.innerHTML = "Aucune donnée de fermentation disponible.";
            return wrapper;
        }
    
        
        if (this.config.layout === "cardsOnly") {
            const infoContainer = this.createInfoContainer();
            infoContainer.classList.add("grid-layout");
            wrapper.appendChild(infoContainer);
            return wrapper;
        }
    
        if (this.config.layout === "horizontal") {
            const canvas = document.createElement("canvas");
            canvas.id = "fermentationChart";
            wrapper.appendChild(canvas);
            
            const infoContainer = this.createInfoContainer();
            infoContainer.classList.add("horizontal-layout");
            wrapper.appendChild(infoContainer);
    
            return wrapper;
        }
    },

    createInfoContainer() {
        const infoContainer = document.createElement("div");
        infoContainer.className = "info-container";
    
        const currentTemp = this.createInfoCard("Température", this.getCurrentTemp() + "°" || "N/A");
        const alcohol = this.createInfoCard("Alcool", Math.floor(this.calculateAlcohol()) + "%" || "N/A");
        const gravity = this.createInfoCard("Densité", this.getCurrentGravity() || "N/A");
        const attenuation = this.createInfoCard("Atténuation", this.calculateAttenuation() + "%" || "N/A");
    
        infoContainer.appendChild(currentTemp);
        infoContainer.appendChild(alcohol);
        infoContainer.appendChild(gravity);
        infoContainer.appendChild(attenuation);
    
        return infoContainer;
    },
    

    renderChart() {
        const canvas = document.getElementById('fermentationChart');
        if (!canvas) {
            console.error("Canvas non trouvé pour le graphique.");
            return;
        }

        const ctx = canvas.getContext('2d');

        
        const formattedData = this.brewData.map(item => ({
            x: new Date(item.createdAt),
            yTemp: parseFloat(item.beerTemp),
            yGravity: parseFloat(item.gravity)
        }));

        new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: "Température",
                        data: formattedData.map(item => ({ x: item.x, y: item.yTemp })),
                        borderColor: "blue",
                        backgroundColor: "rgba(0,0,255,0.1)",
                        fill: false,
                        yAxisID: 'y-temp',
                        tension: 0.4,
                        pointRadius: 0
                    },
                    {
                        label: "Densité",
                        data: formattedData.map(item => ({ x: item.x, y: item.yGravity })),
                        borderColor: "green",
                        backgroundColor: "rgba(0,255,0,0.1)",
                        fill: false,
                        yAxisID: 'y-density',
                        tension: 0.3,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                scales: {
                    xAxes: [{
                        type: 'time',
                        time: {
                            unit: 'day', 
                            displayFormats: {
                                day: 'DD MMM' 
                            }
                        },
                        ticks: {
                            maxTicksLimit: 10 
                        }
                    }],
                    yAxes: [
                        {
                            id: 'y-temp',
                            type: 'linear',
                            position: 'right',
                            scaleLabel: {
                                display: true,
                                labelString: 'Température (°C)'
                            }
                        },
                        {
                            id: 'y-density',
                            type: 'linear',
                            position: 'left',
                            scaleLabel: {
                                display: true,
                                labelString: 'Densité'
                            }
                        }
                    ]
                }
            }
        });
    },

    getCurrentTemp() {
        const lastEntry = this.brewData[this.brewData.length - 1];
        return lastEntry ? lastEntry.beerTemp : null;
    },

    getCurrentGravity() {
        const lastEntry = this.brewData[this.brewData.length - 1];
        return lastEntry ? lastEntry.gravity : null;
    },

    calculateAlcohol() {
        const initialGravity = this.getInitialGravity();
        const finalGravity = this.getCurrentGravity();
        if (initialGravity && finalGravity) {
            const abv = (initialGravity - finalGravity) * 131.25;
            return abv.toFixed(2); 
        }
        return "N/A";
    },

    calculateAttenuation() {
        const initialGravity = Number(this.getInitialGravity());
        console.log(initialGravity)
        const finalGravity = this.getCurrentGravity();
        if (initialGravity && finalGravity && initialGravity > 1) {
            const attenuation = ((initialGravity - finalGravity) / (initialGravity - 1)) * 100;
            return attenuation.toFixed(1); 
        }
        return "N/A";
    },

    getInitialGravity() {
        console.log(this.recipeData)
        return this.recipeData["estOG"];
    },
    
    getCurrentGravity() {
        if (this.brewData.length > 0) {
            return parseFloat(this.brewData[this.brewData.length - 1].gravity); 
        }
        return null;
    },

    createInfoCard(label, value) {
        const card = document.createElement("div");
        card.className = "info-card";
    
        const valueEl = document.createElement("div");
        valueEl.className = "value";
        valueEl.innerText = value;
    
        const labelEl = document.createElement("div");
        labelEl.className = "label";
        labelEl.innerText = label;
    
        card.appendChild(valueEl);
        card.appendChild(labelEl);
    
        return card;
    },    
});