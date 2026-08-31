import { getDailyDateKey } from './game.js';

export const STORAGE_KEYS = Object.freeze({
    daily: 'cheesecakefactorydle:daily:',
    multiguess: 'cheesecakefactorydle:multiguess:daily:'
});

export class DailyStorage {
    constructor(prefix, storage = window.localStorage) {
        this.prefix = prefix;
        this.storage = storage;
    }

    key(dateKey = getDailyDateKey()) {
        return `${this.prefix}${dateKey}`;
    }

    read(dateKey = getDailyDateKey()) {
        try {
            const state = JSON.parse(this.storage.getItem(this.key(dateKey)));
            return state && state.dateKey === dateKey ? state : null;
        } catch (error) {
            console.warn('Unable to read the saved daily game:', error);
            return null;
        }
    }

    write(state, dateKey = getDailyDateKey()) {
        try {
            const activeKey = this.key(dateKey);
            this.storage.setItem(activeKey, JSON.stringify({ ...state, dateKey }));
            for (let index = this.storage.length - 1; index >= 0; index--) {
                const key = this.storage.key(index);
                if (key?.startsWith(this.prefix) && key !== activeKey) this.storage.removeItem(key);
            }
        } catch (error) {
            console.warn('Unable to save the daily game:', error);
        }
    }
}
