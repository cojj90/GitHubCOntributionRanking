export class Utility {
    
    // iterate obj and fetch [key, value]
    static * entries(obj: Object) {
        for (let key of Object.keys(obj)) {
            yield [key, obj[key]];
        }
    }
}