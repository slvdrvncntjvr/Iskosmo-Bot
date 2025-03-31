const { exec } = require('child_process');
const logger = require('./logger');

class DeviceManager {
    constructor() {
        this.thermalState = 'normal';
        this.batteryLevel = 100;
        this.isCharging = true;
        this.lastCheck = 0;
        this.checkInterval = 10 * 60 * 1000; 
    }
    
    async checkDeviceStatus() {
        const now = Date.now();
        if (now - this.lastCheck < this.checkInterval) return;
        this.lastCheck = now;
        
        try {
            const [batteryInfo, tempInfo] = await Promise.all([
                this.getBatteryInfo(),
                this.getTemperature()
            ]);
            
            this.batteryLevel = batteryInfo.level;
            this.isCharging = batteryInfo.charging;

            logger.info(`Device status: Battery ${this.batteryLevel}% (${this.isCharging ? 'Charging' : 'Discharging'}), Temp: ${tempInfo.temp}°C`);

            if (tempInfo.temp > 45) { 
                if (this.thermalState !== 'throttled') {
                    logger.warn(`Device temperature high (${tempInfo.temp}°C), enabling thermal throttling`);
                    this.thermalState = 'throttled';
                }
            } else if (this.thermalState === 'throttled' && tempInfo.temp < 40) {
                logger.info(`Device temperature normal (${tempInfo.temp}°C), disabling thermal throttling`);
                this.thermalState = 'normal';
            }
 
            if (!this.isCharging && this.batteryLevel < 20) {
                logger.warn(`Low battery (${this.batteryLevel}%), reducing functionality`);
            }
        } catch (error) {
            logger.error('Error checking device status:', error);
        }
    }
    getBatteryInfo() {
        return new Promise((resolve) => {
            exec('termux-battery-status 2>/dev/null || echo \'{"status":"error"}\'', (error, stdout) => {
                try {
                    const data = JSON.parse(stdout);
                    if (data.status === 'error') {
                        resolve({ level: 100, charging: true });
                        return;
                    }
                    
                    resolve({
                        level: data.percentage || 100,
                        charging: data.status === 'CHARGING' || data.status === 'FULL'
                    });
                } catch (e) {
                    resolve({ level: 100, charging: true });
                }
            });
        });
    }

    getTemperature() {
        return new Promise((resolve) => {
            exec('cat /sys/class/thermal/thermal_zone*/temp 2>/dev/null || echo "0"', (error, stdout) => {
                try {
                    const temps = stdout.trim().split('\n')
                        .map(t => parseInt(t))
                        .filter(t => !isNaN(t));
                    
                    if (temps.length === 0) {
                        resolve({ temp: 30 }); 
                        return;
                    }

                    let avgTemp = temps.reduce((sum, temp) => sum + temp, 0) / temps.length;

                    if (avgTemp > 1000) avgTemp /= 1000;
                    
                    resolve({ temp: avgTemp });
                } catch (e) {
                    resolve({ temp: 30 }); 
                }
            });
        });
    }

    shouldThrottle() {
        return this.thermalState === 'throttled' || (!this.isCharging && this.batteryLevel < 15);
    }

    getOperationMode() {
        if (this.shouldThrottle()) {
            return 'power_save';
        }
        
        if (!this.isCharging && this.batteryLevel < 30) {
            return 'balanced';
        }
        
        return 'performance';
    }
}

module.exports = new DeviceManager();