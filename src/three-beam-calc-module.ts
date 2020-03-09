const SteelLibrary = require('../assets/SteelLibraryDataSchema.json');

enum BEAM_ENUM {
    BEAM1,
    BEAM2,
    BEAM3,
}

enum REACTIONTYPE {
    LEFTREACTION = 'LEFT_REACTION',
    RIGHTREACTION = 'RIGHT_REACTION',
}

enum BENDINGMOMENT {
    LEFTBENDINGMOMENT = 'LEFT_BENDING_MOMENT',
    RIGHTBENDINGMOMENT = 'RIGHT_BENDING_MOMENT',
}

enum CONSTANTS {
    FACTOR_ARC_OF_CONTACT = 180,
    FACTOR_MAX_DEFLECTION = 1666,
    FACTOR_ZU_EXISTING_BEAMS = 17600,
    FACTOR_ZU_NEW_BEAMS = 19300,
    FACTOR_INCH_TO_FEET = 12,
    BEAM_SPACING_RATIO_FIRST_BEAM = 0.8,
    BEAM_SPACING_RATIO_SECOND_BEAM = 0.8,
    BEAM_SPACING_RATIO_THIRD_BEAM = 0.2,
    MODULUS_OF_ELASTICITY = 29000000,
    BORDERLINE_UPPER_LIMIT = 1.0,
    BORDERLINE_LOWER_LIMIT = 0.9,
}

enum LOAD_TYPE {
    POINTLOAD = 'PointLoad',
    MIDPOINTLOAD = 'MidPointLoad',
    ADDITIONALLOAD = 'AdditionalLoad#',
}

enum BEAM_TYPE {
    NEW = 'New',
    EXISTING = 'Existing',
}

enum BEAM_STATUS {
    YES = 'Yes',
    BORDERLINE = 'Borderline',
    NO = 'No',
}

/* class name : ThreeBeamCalcModule
Descitption: This class calculates parameters of 3-Beam Calculator Module.
It implements 'ICalcModule' interface with method 'calculate()'.
*/
export class ThreeBeamCalcModule {


    public calcData: any;

    /* Function signature : calculate(calculatorModel: ICalcDataModel): ICalcDataModel
    Function description : This function updates the calculated parameters in 'calculatorModel' input.
    Input Parameters: calculatorModel
    Output Parameters: updated calculatorModel
    */
    public calculate(calcData: any) {

        this.calcData = calcData;

        this.calculateLiveLoad();
        this.calculateDeadLoad();
        this.beamParamCalculations();
        this.calculateMaxReqSectionModulus();
        this.steelCalculations();

        /* returning 'calculatorModel' input json after updating the
        calculated parameters present in 'calculatorModel' input using 'this.calcData' */
        return this.calcData;
    }

    /* This function calculates the gross total of live load,
    and total live load existing on the three beam structure */
    private calculateLiveLoad() {
        this.calcData._grossTotalLiveLoad = this.getGrossTotalLiveLoad();
        this.calcData._totalLiveLoad = this.getTotalLiveLoad();
    }

    /* This function calculates the gross total of live load */
    private getGrossTotalLiveLoad(): number {
        const grossLiveLoad = this.calcData._carWeight +
            this.calcData._capacity +
            this.calcData._counterWeight +
            this.calcData._hoistRopeWeight +
            this.calcData._compensationWeight +
            this.calcData._travellingCableWeight;
        return grossLiveLoad;
    }

    /* This function calculates the total live load */
    private getTotalLiveLoad(): number {
        let totalLiveLoad: number = 0;
        totalLiveLoad = ((2 * (this.calcData._carWeight +
            this.calcData._capacity +
            (0.5 * this.calcData._hoistRopeWeight) +
            (0.5 * this.calcData._compensationWeight) +
            this.calcData._travellingCableWeight
        )) / this.calcData._carRopingRatio._leftValue) +
            ((2 * (this.calcData._counterWeight +
            (0.5 * this.calcData._hoistRopeWeight) +
            (0.5 * this.calcData._compensationWeight)
        )) / this.calcData._counterWeightRopingRatio._leftValue);

        return totalLiveLoad;
    }

    /* This function is used to calculate total dead load existing on the three beam structure */
    private calculateDeadLoad() {
        this.getFloorSlabWeight();
        this.calcData._totalDeadLoad =
            this.calcData._blockUpBeamsWeight +
            this.calcData._machineWeight +
            this.calcData._motorWeight +
            this.calcData._isolationWeight +
            this.calcData._floorSlabWeight +
            this.calcData._deflectorWeight;
    }

    /* This function is used to calculate the weight of floor slab */
    private getFloorSlabWeight() {
        const maxLength: number = Math.max.apply(
            Math, this.calcData._beamParams.map(
                (beamObj: any) => {
                return beamObj._distanceBetweenReactions_L;
            },
        ));
        this.calcData._floorSlabWeight = this.calcData._slabThickness *
            (maxLength / CONSTANTS.FACTOR_INCH_TO_FEET) * (
                this.calcData._machineBeamSpacing_Z.Z / CONSTANTS.FACTOR_INCH_TO_FEET) * (11.5);
    }

    /* This function is used to calculate parameters of each beam */
    private beamParamCalculations() {

        this.calcData._beamParams.forEach((beamObj: any) => {

            this.calcData._totalDeadLoad = this.calcData._totalDeadLoad +
                                            beamObj._machineBeamWeight +
                                            beamObj._blockingBeamWeight;

            this.machineLoadPointCalculations(beamObj);
            this.rankBeamPoints(beamObj);
            this.calculateReactionForce(beamObj);
            this.calculateBendingMoment(beamObj);
            this.calculateBeamSectionModulus(beamObj);
            this.calculateMaximumDeflection(beamObj);
        });

    }

    /* This function calculates the parameters existing on each load point*/
    private machineLoadPointCalculations(beamObj: any) {
        beamObj._machineLoadPoints.forEach((loadPointObj: any) => {
            this.calculatePointDistance(beamObj._distanceBetweenReactions_L, loadPointObj);
            this.calculateValueV1(loadPointObj);
            this.calculatePointLiveLoad(beamObj, loadPointObj);
            this.calculatePointDeadLoad(beamObj, loadPointObj);
            this.calculateTotalLoad(loadPointObj);
            this.calculateStaticLoad(loadPointObj);
        });
    }

    /* This function assigns rank to each load point,
     on the basis of their distance from left reaction point of a beam */
    private rankBeamPoints(beamObj: any) {
        let rank: number = 1;
        beamObj._machineLoadPoints.sort((pointObj1: any, pointObj2: any) => {
            return pointObj1._distanceLeft_a - pointObj2._distanceLeft_a;
        });
        let loadPoint: number = 0;
        for (loadPoint = 0; loadPoint < beamObj._machineLoadPoints.length - 1; loadPoint++) {
            beamObj._machineLoadPoints[loadPoint]._rank = rank;
            if (
                beamObj._machineLoadPoints[loadPoint]._distanceLeft_a <
                beamObj._machineLoadPoints[loadPoint + 1]._distanceLeft_a
                ) {
                rank++;
            }
        }
        beamObj._machineLoadPoints[loadPoint]._rank = rank;
    }
    /* This function calculates live load existing on a point of a beam */
    private calculatePointLiveLoad(beamObj: any, pointObj: any) {
        // Live load of mid point is 0
        if (pointObj._loadType === LOAD_TYPE.POINTLOAD) {
            let liveLoad: number = 0;
            if (beamObj._beamIndex === BEAM_ENUM.BEAM1 || beamObj._beamIndex === BEAM_ENUM.BEAM2) {
                liveLoad  = (this.calcData._arcOfContact / CONSTANTS.FACTOR_ARC_OF_CONTACT) *
                this.calcData._totalLiveLoad * (
                    (CONSTANTS.BEAM_SPACING_RATIO_FIRST_BEAM) - (
                        (CONSTANTS.BEAM_SPACING_RATIO_FIRST_BEAM) * (
                (this.calcData._machineBeamSpacing_Z.X) /
                (this.calcData._machineBeamSpacing_Z.X +  this.calcData._machineBeamSpacing_Z.Y)
                )));
                liveLoad = this.roundUptoDecimalPlace(liveLoad, 1);
                pointObj._liveLoad = liveLoad;
            } else if (beamObj._beamIndex === BEAM_ENUM.BEAM3) {
                liveLoad = (this.calcData._arcOfContact / CONSTANTS.FACTOR_ARC_OF_CONTACT) *
                this.calcData._totalLiveLoad * (CONSTANTS.BEAM_SPACING_RATIO_THIRD_BEAM);
                liveLoad = this.roundUptoDecimalPlace(liveLoad, 1);
                pointObj._liveLoad = liveLoad;
            } else {
                // other beams
            }
        }
    }

    /* This function calculates dead load existing on a point of a beam */
    private calculatePointDeadLoad(beamObj: any, pointObj: any) {
        // dead loads of additional loads is 0
            if (pointObj._loadType === LOAD_TYPE.POINTLOAD) {
                let deadLoad: number = (this.calcData._machineWeight +
                this.calcData._motorWeight + this.calcData._isolationWeight) / 3;
                deadLoad = this.roundUptoDecimalPlace(deadLoad, 1);
                pointObj._deadLoad = deadLoad;
            } else if (pointObj._loadType === LOAD_TYPE.MIDPOINTLOAD) {
                let deadLoad: number = beamObj._machineBeamWeight +
                beamObj._blockingBeamWeight + (this.calcData._blockUpBeamsWeight / 3) +
                (this.calcData._floorSlabWeight / 3);
                deadLoad = this.roundUptoDecimalPlace(deadLoad, 1);
                pointObj._deadLoad = deadLoad;
            } else {
                // other points type
            }
    }

    /* This function calculates total load existing on a point of a beam */
    private calculateTotalLoad(pointObj: any) {
        pointObj._totalLoad = pointObj._liveLoad + pointObj._deadLoad;
    }

    /* This function calculates static load existing on a point of a beam */
    private calculateStaticLoad(pointObj: any) {
        pointObj._staticLoad = (pointObj._liveLoad) / 2;
    }

    /* This function calculates momentum of a load with respect to a point of a beam */
    private getMomentum(load: number, distance: number) {
        let momentum: any = 0;
        momentum = load * distance;
        return momentum;
    }

    /* This function calculates both the reaction forces existing on a beam */
    private calculateReactionForce(beamObj: any) {
        const reactionForceObj: any = this.getReaction(beamObj);
        beamObj._reactions._reactionLeft = reactionForceObj[REACTIONTYPE.LEFTREACTION];
        beamObj._reactions._reactionRight = reactionForceObj[REACTIONTYPE.RIGHTREACTION];
    }

    /* This function calculates and returns a single reaction force of a beam */
    private getReaction(beamObj: any) {
        let momentumLeftReaction: number = 0;
        let momentumRightReaction: number = 0;
        const reactionForceObj: any = {};

        beamObj._machineLoadPoints.forEach((loadPointObj: any) => {
            momentumRightReaction = momentumRightReaction +
            this.getMomentum(loadPointObj._totalLoad, loadPointObj._distanceRight_b);
            momentumLeftReaction = momentumLeftReaction +
            this.getMomentum(loadPointObj._totalLoad, loadPointObj._distanceLeft_a);
        });

        reactionForceObj[REACTIONTYPE.LEFTREACTION] = momentumRightReaction / beamObj._distanceBetweenReactions_L;
        reactionForceObj[REACTIONTYPE.RIGHTREACTION] = momentumLeftReaction / beamObj._distanceBetweenReactions_L;


        return reactionForceObj;
    }

    /* this function calculates bending moment existing on a beam */
    private calculateBendingMoment(beamObj: any) {
        const referencePointObj: any = this.getRefrencePoint(beamObj);
        const bendingMomentObj: any = this.getBendingMoment(beamObj, referencePointObj);
        beamObj._bendingMoments._bendingMomentLeft = bendingMomentObj[BENDINGMOMENT.LEFTBENDINGMOMENT];
        beamObj._bendingMoments._bendingMomentRight = bendingMomentObj[BENDINGMOMENT.RIGHTBENDINGMOMENT];
    }

    private getBendingMoment(beamObj: any, referencePointObj: any) {
        const bendingMomentObj: any = {};
        let leftBendingMoment: number =
        this.getMomentum(beamObj._reactions._reactionLeft, referencePointObj._distanceLeft_a);
        let rightBendingMoment: number =
        this.getMomentum(beamObj._reactions._reactionRight, referencePointObj._distanceRight_b);
        const referencePointIndex: number = referencePointObj._rank - 1;
        beamObj._machineLoadPoints.forEach((loadpointObj: any, index: number) => {
            if (index < referencePointIndex) {
                leftBendingMoment = leftBendingMoment -
                this.getMomentum(loadpointObj._totalLoad,
                    referencePointObj._distanceLeft_a - loadpointObj._distanceLeft_a);
            } else if (index > referencePointIndex) {
                rightBendingMoment = rightBendingMoment -
                this.getMomentum(loadpointObj._totalLoad,
                    loadpointObj._distanceLeft_a - referencePointObj._distanceLeft_a);
            }
        });

        bendingMomentObj[BENDINGMOMENT.LEFTBENDINGMOMENT] = leftBendingMoment;
        bendingMomentObj[BENDINGMOMENT.RIGHTBENDINGMOMENT] = rightBendingMoment;
        return bendingMomentObj;
    }

    /* This function returns the reference load point,
     with respect to which we need to calculate momentum of other loads existing on the beam*/
    private getRefrencePoint(beamObj: any) {
        let sumTotalLoad: number = 0;
        const referencePointObj: any = beamObj._machineLoadPoints.find((loadPointObj: any) => {
            sumTotalLoad = sumTotalLoad + loadPointObj._totalLoad;
            if (beamObj._reactions._reactionLeft <= sumTotalLoad) {
                return true;
            } else {
                return false;
            }
        });
        return referencePointObj;
    }

    /* This function calculates the required section modulus of a beam */
    private calculateBeamSectionModulus(beamObj: any) {
        const requiredBeamSectionModulus: number =
        this.getReqSectionModulus(beamObj._bendingMoments._bendingMomentLeft,
            beamObj._bendingMoments._bendingMomentRight);
        beamObj._requiredSectionModulus_Zu = requiredBeamSectionModulus;
    }

    /* Calculates maximum bending moment reuired for selection of beam */
    private calculateMaxReqSectionModulus() {
        let maximumRequiredSectionModulus: number = 0;
        this.calcData._beamParams.forEach((beamObj: any) => {
            if (maximumRequiredSectionModulus < beamObj._requiredSectionModulus_Zu) {
                maximumRequiredSectionModulus = beamObj._requiredSectionModulus_Zu;
            }
        });
        this.calcData._maximumRequiredSectionModulus_Zu = maximumRequiredSectionModulus;
    }

    /* This function calculates the required section modulus of a beam */
    private getReqSectionModulus(...bendingMoments: number[]) {
        let requiredSectionModulus: number = 0;
        const maximumBendingMoment: number = Math.max(...bendingMoments);
        if (this.calcData._beamType === BEAM_TYPE.NEW) {
            requiredSectionModulus = maximumBendingMoment / CONSTANTS.FACTOR_ZU_NEW_BEAMS;
        } else if (this.calcData._beamType === BEAM_TYPE.EXISTING) {
            requiredSectionModulus = maximumBendingMoment / CONSTANTS.FACTOR_ZU_EXISTING_BEAMS;
        }
        return requiredSectionModulus;
    }

    /* This function calculates maximum deflection of a beam */
    private calculateMaximumDeflection(beamObj: any) {
        beamObj._maximumDeflection = (beamObj._distanceBetweenReactions_L) / CONSTANTS.FACTOR_MAX_DEFLECTION;
    }

    /* This function calculates distance between point load and right reaction point of a beam */
    private calculatePointDistance(length: number, loadPointObj: any) {
        loadPointObj._distanceRight_b = length - loadPointObj._distanceLeft_a;
    }

    private calculateValueV1(loadPointObj: any) {
        // val = b*sqrt(1/3+(2*a/3*b))
        let valueV1: number = 0;
        valueV1 = loadPointObj._distanceRight_b *
            (Math.sqrt((1 / 3) +
                ((2 * loadPointObj._distanceLeft_a) / (3 * loadPointObj._distanceRight_b)))
            );
        loadPointObj._valueV1 = valueV1;
    }

    /* This function calculates the selection status of input steel beams,
    based on the value of reaction force and deflection, existing on a beam*/
    private steelCalculations() {
        SteelLibrary.forEach((steelLibMember: any) => {
            const steelObj: any = {};
            steelObj._steelLabel = steelLibMember.steelLabel;
            steelObj._steelMeta = this.getSteelMetaData(steelLibMember);
            steelObj._calculations = {};
            steelObj._calculations._sectionModulusStatus = 
            this.getSteelStatus(this.calcData._maximumRequiredSectionModulus_Zu, 
                steelLibMember.sectionModulus_Zu);
            steelObj._calculations._deflectionStatus = this.getSteelDeflectionStatus(steelLibMember);
            this.calcData._steelLibraryMembers.push(steelObj);
        });
    }

    /* This function calculates meta data of input steel beam */
    private getSteelMetaData(steelObj: any) {
        const steelMetaData: any = {};
        steelMetaData._sectionModulus_Zu = steelObj.sectionModulus_Zu;
        steelMetaData._momentofInertia_I = steelObj.momentOfInertia_I;
        steelMetaData._shape = this.getSteelShape(steelObj);
        return steelMetaData;
    }

    /* This function calculates shape, height and weight per unit length of input steel beam */
    private getSteelShape(steelObj: any) {
        const steelShape: any = {};
        steelShape._type = steelObj.Shape;
        steelShape._height = steelObj.height;
        steelShape._weightPerUnitLength = steelObj.weightPerUnitLength;
        return steelShape;
    }

    /* This function calculates selection status of input steel beam,
     using deflection of a beam */
    private getSteelDeflectionStatus(steelObj: any) {
        const deflectionStatusArray: any[] = [];
        this.calcData._beamParams.forEach((beamObj: any) => {
            this.mergeEqualRankPoints(beamObj);
            const deflectionStatusObj: any = this.getDeflectionStatus(steelObj, beamObj);
            if (deflectionStatusObj) {
                deflectionStatusArray.push(deflectionStatusObj);
            }
        });
        return deflectionStatusArray;
    }

    /* This function merges load points,
     which exists at same distance from left reaction point of a beam */
    private mergeEqualRankPoints(beamObj: any) {
        const existingPoint: any = {};
        beamObj._machineLoadPoints.forEach((loadPoint: any) => {
            if (existingPoint[loadPoint._distanceLeft_a]) {
                const equalRankPointObj: any = existingPoint[loadPoint._distanceLeft_a];

                /* Adding loads of point existing at same location */
                equalRankPointObj._liveLoad = equalRankPointObj._liveLoad + loadPoint._liveLoad;
                equalRankPointObj._deadLoad = equalRankPointObj._deadLoad + loadPoint._deadLoad;
                equalRankPointObj._totalLoad = equalRankPointObj._totalLoad + loadPoint._totalLoad;
                equalRankPointObj._staticLoad = equalRankPointObj._staticLoad + loadPoint._staticLoad;

                /* Removing merged load point from beam */
                loadPoint._liveLoad = 0;
                loadPoint._deadLoad = 0;
                loadPoint._totalLoad = 0;
                loadPoint._staticLoad = 0;
                loadPoint._distanceLeft_a = 0;
                loadPoint._distanceRight_b = beamObj._distanceBetweenReactions_L;
                this.calculateValueV1(loadPoint);
            } else {
                existingPoint[loadPoint._distanceLeft_a] = loadPoint;
            }
        });

    }

    private getDeflectionStatus(steelObj: any, beamObj: any) {
        const deflectionStatusObj: any = {};
        deflectionStatusObj._beamIndex = beamObj._beamIndex;
        deflectionStatusObj._pointDeflection = this.getPointsDeflection(steelObj, beamObj);
        deflectionStatusObj._totalDeflection = this.getTotalDeflection(deflectionStatusObj);
        deflectionStatusObj._status = 
        this.getSteelStatus(deflectionStatusObj._totalDeflection, 
            beamObj._maximumDeflection);
        return deflectionStatusObj;
    }

    private getPointsDeflection(steelObj: any, beamObj: any) {
        const pointDeflectionArray: any[] = [];
        beamObj._machineLoadPoints.forEach((loadPointObj: any) => {
            const pointDeflectionObj: any = this.getPointDeflection(steelObj, loadPointObj);
            if (pointDeflectionObj) {
                pointDeflectionArray.push(pointDeflectionObj);
            }
        });
        return pointDeflectionArray;
    }

    /* This function calculates total deflection of a beam due to all load points existing on a beam*/
    private getTotalDeflection(deflectionStatusObj: any) {
        let totalDeflection: number = 0;
        deflectionStatusObj._pointDeflection.forEach((pointDeflection: any) => {
            totalDeflection = totalDeflection + pointDeflection._deflection;
        });
        return totalDeflection;
    }

    private getPointDeflection(steelObj: any, loadPointObj: any) {
        let pointDeflection: number = 0;
        const pointDeflectionObj: any = {};
        pointDeflectionObj._rank = loadPointObj._rank;
        pointDeflection = ((loadPointObj._staticLoad + loadPointObj._deadLoad) *
                    (loadPointObj._distanceLeft_a) * Math.pow(loadPointObj._valueV1, 3)) /
                    (3 * CONSTANTS.MODULUS_OF_ELASTICITY * (
                        loadPointObj._distanceLeft_a + loadPointObj._distanceRight_b
                        )
                    * steelObj.momentOfInertia_I);
        pointDeflectionObj._deflection = pointDeflection;
        return pointDeflectionObj;
    }

    private getSteelStatus(requiredValue: number, referencedValue: number) {
        if (requiredValue > referencedValue) {
            return BEAM_STATUS.NO;
        } else if (
            CONSTANTS.BORDERLINE_LOWER_LIMIT <
            (requiredValue / referencedValue) && (requiredValue / referencedValue) <
            CONSTANTS.BORDERLINE_UPPER_LIMIT) {
            return BEAM_STATUS.BORDERLINE;
        } else {
            return BEAM_STATUS.YES;
        }
    }


    private roundUptoDecimalPlace(data: number, numberOfDecimalPlaces: number) {
        let roundedData: number = 0;
        if (data && numberOfDecimalPlaces >= 0) {
            roundedData = parseInt(data.toFixed(numberOfDecimalPlaces), 10);
        }
        return roundedData;
    }

}
