class ThreeBeamCalcModuleWrapper {
    threeBeamCalcModule = null;
    constructor(){
        this.threeBeamCalcModule = new Calculator.ThreeBeamCalcModule();
    }

    calculateReactionnAndDeflection(inputJSON){
            let resultJSON= this.threeBeamCalcModule.calculate(inputJSON);
            console.log(resultJSON);
            return resultJSON;
    }
}