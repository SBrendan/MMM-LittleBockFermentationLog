
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
        updateInterval: 60 * 60 * 1000,
        apiToken: "", 
        apiUrl: "https://www.littlebock.fr/api",
        brewSessionID: "",
        animationSpeed: 500,
        layout: "cardsOnly",  
    },

    start () {
        this.brewData = [];
        this.recipeData = {};
        this.loaded = false;
        this.getDataFromLittleBockAPI();
        this.getReceipeDataFromLittleBockAPI();
        this.scheduleUpdate();
    },

    getTranslations: function() {
        return {
            fr: "translations/fr.json",
            en: "translations/en.json",
        }
    },

    getHeader () {
        if (this.loaded && this.recipeData.name) {
            return `${this.translate("TITLE")} ${this.recipeData.name}`;
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
            this.isBothLoaded();
        }

        if (notification === "MMM-LittleBockFermentationLog_RECIPE_DATA_RESULT") {
            this.recipeData = payload
            this.updateDom(this.config.animationSpeed);
            domReady('#fermentationChart').then(() => {
                this.renderChart();
            });
            this.isBothLoaded();
        }
    },

    isBothLoaded() {
        if (this.recipeData && this.brewData) {
            this.loaded = true
        }
    },


    getDom() {
        const wrapper = document.createElement("div");
        wrapper.className = "littlebock-container";
        
        if (!this.loaded || !this.brewData) {
            wrapper.innerHTML = this.translate("LOADING");
            return wrapper;
        }
    
        
        if (this.brewData.length === 0) {
            const messageContainer = document.createElement("div");
            messageContainer.className = "no-data-container";
            
            const message = document.createElement("p");
            message.innerText = this.translate("NOT_FOUND");
            messageContainer.appendChild(message);
            
            const img = document.createElement("img");
            img.src = "./modules/MMM-LittleBockFermentationLog/images/biere.png";
            img.alt = this.translate("NOT_FOUND");
            img.className = "no-data-image";
            messageContainer.appendChild(img);
            
            wrapper.appendChild(messageContainer);
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
    
        const currentTemp = this.createInfoCard(this.translate("TEMPERATURE"), this.getCurrentTemp() + "°" || "N/A");
        const alcohol = this.createInfoCard(this.translate("ALCOOL"), Math.floor(this.calculateAlcohol()) + "%" || "N/A");
        const gravity = this.createInfoCard(this.translate("GRAVITY"), this.getCurrentGravity() || "N/A");
        const attenuation = this.createInfoCard(this.translate("ATTENUATION"), this.calculateAttenuation() + "%" || "N/A");
    
        infoContainer.appendChild(currentTemp);
        infoContainer.appendChild(alcohol);
        infoContainer.appendChild(gravity);
        infoContainer.appendChild(attenuation);
    
        return infoContainer;
    },
    

    renderChart() {
        const canvas = document.getElementById('fermentationChart');
        if (!canvas) {
            console.error("Canvas not found for chart");
            return;
        }

        const ctx = canvas.getContext('2d');

        
        const formattedData = this.brewData.map(item => ({
            x: new Date(item.createdAt),
            yTemp: parseFloat(item.beerTemp),
            yGravity: parseFloat(item.gravity)
        }));

        const valuesToDrawLinesAt = [
            {value: this.getInitialGravity(), color: "green", lineWidth: 2, lineDash: [5, 5], text: "DI" },
            {value: this.getFinaleGravity(), color: "red",  lineWidth: 2, lineDash: [5, 5], text: "DF" },
        ]
        new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: this.translate("TEMPERATURE"),
                        data: formattedData.map(item => ({ x: item.x, y: item.yTemp })),
                        borderColor: "blue",
                        backgroundColor: "rgba(0,0,255,0.1)",
                        fill: false,
                        yAxisID: 'y-temp',
                        tension: 0.4,
                        pointRadius: 0
                    },
                    {
                        label: this.translate("GRAVITY"),
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
                        }
                    }],
                    yAxes: [
                        {
                            id: 'y-temp',
                            type: 'linear',
                            position: 'right',
                            scaleLabel: {
                                display: true,
                                labelString: this.translate("TEMPERATURE")
                            },
                            ticks: {
                                stepSize: 4
                            },
                        },
                        {
                            id: 'y-density',
                            min: 1.000,
                            type: 'linear',
                            position: 'left',
                            scaleLabel: {
                                display: true,
                                labelString: this.translate("GRAVITY")
                            },
                            ticks: {
                                stepSize: 0.04
                            },
                        }
                    ]
                }
            },
            plugins: {
                beforeDraw: function(chart) {

                    const ctx = chart.ctx;
                    const yScale = chart.scales['y-density'];
            
                    ctx.save();
                    ctx.font = '12px Arial';

                    valuesToDrawLinesAt.forEach(item => {
                        if (item.value) {
                            const yPos = yScale.getPixelForValue(item.value);
                            ctx.fillStyle = item.color;
                            ctx.strokeStyle = item.color;
                            ctx.lineWidth = item.lineWidth;
                            ctx.setLineDash(item.lineDash);
                            ctx.fillText(item.text, chart.chartArea.left + 5, yPos - 5);
                            ctx.beginPath();
                            ctx.moveTo(chart.chartArea.left, yPos);
                            ctx.lineTo(chart.chartArea.right, yPos);
                            ctx.stroke();
                        }
                    });
            
                    ctx.restore();
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
        const finalGravity = this.getCurrentGravity();
        if (initialGravity && finalGravity && initialGravity > 1) {
            const attenuation = ((initialGravity - finalGravity) / (initialGravity - 1)) * 100;
            return attenuation.toFixed(1); 
        }
        return "N/A";
    },

    getInitialGravity() {
        return this.recipeData["estOG"];
    },

    getFinaleGravity() {
        return this.recipeData["estFG"];
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
