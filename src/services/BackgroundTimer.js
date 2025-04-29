import BackgroundTimer from 'react-native-background-timer';

class BackgroundTimerWrapper {
    constructor() {
        this.timers = new Map();
        this.nextTimerId = 0;
    }

    start() {
        BackgroundTimer.start();
    }

    stop() {
        BackgroundTimer.stop();
    }

    setTimeout(callback, timeout) {
        const id = this.nextTimerId++;
        this.timers.set(id, BackgroundTimer.setTimeout(() => {
            this.timers.delete(id);
            callback();
        }, timeout));
        return id;
    }

    clearTimeout(timerId) {
        if (this.timers.has(timerId)) {
            BackgroundTimer.clearTimeout(this.timers.get(timerId));
            this.timers.delete(timerId);
        }
    }

    setInterval(callback, timeout) {
        const id = this.nextTimerId++;
        this.timers.set(id, BackgroundTimer.setInterval(callback, timeout));
        return id;
    }

    clearInterval(timerId) {
        if (this.timers.has(timerId)) {
            BackgroundTimer.clearInterval(this.timers.get(timerId));
            this.timers.delete(timerId);
        }
    }
}

export default new BackgroundTimerWrapper(); 