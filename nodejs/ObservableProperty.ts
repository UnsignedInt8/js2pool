
import { Event } from "./Event";

export default class ObservableProperty<T> extends Event {
    value: T;

    constructor(value: T) {
        super();
        this.value = value;
    }

    protected static Events = {
        propertyChanged: 'PropertyChanged'
    }

    onPropertyChanged(callback: (oldValue: T, newValue: T) => void) {
        super.register(ObservableProperty.Events.propertyChanged, callback);
        return this;
    }

    set(value: T) {
        let oldValue = this.value;
        this.value = value;
        super.trigger(ObservableProperty.Events.propertyChanged, oldValue, value);
        return this;
    }

    hasValue() {
        return this.value != undefined && this.value != null ? true : false;
    }

    static init<T>(value: T) {
        return new ObservableProperty(value);
    }
}