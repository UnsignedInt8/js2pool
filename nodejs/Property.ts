
import { Event } from "./Event";

export default class Property<T> extends Event {
    value: T;

    constructor(value: T) {
        super();
        this.value = value;
    }

    protected static Events = {
        propertyChanged: 'PropertyChanged'
    }

    onPropertyChanged(callback: (oldValue: T, newValue: T) => void) {
        super.register(Property.Events.propertyChanged, callback);
    }

    set(value: T) {
        let oldValue = this.value;
        this.value = value;
        super.trigger(Property.Events.propertyChanged, oldValue, value);
    }

    static init<T>(value: T) {
        return new Property(value);
    }
}