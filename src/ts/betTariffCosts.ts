/*
 * Copyright (c) 2018-2026 GraphDefined GmbH <achim.friedland@graphdefined.com>
 * This file is part of Chargy WebApp <https://github.com/OpenChargingCloud/ChargyWebApp>
 *
 * Licensed under the Affero GPL license, Version 3.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.gnu.org/licenses/agpl.html
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import Decimal from 'decimal.js';
import type {
    IOCMFBonnTariff,
    IMeasurement
} from '@open-charging-cloud/chargy-core';


export interface IBETTariffCosts {
    currency:            "EUR";
    startFee:            Decimal;
    chargedEnergyKWh:    Decimal;
    billedEnergyKWh:     Decimal;
    energyCosts:         Decimal;
    durationMinutes:     Decimal;
    billableMinutes:     number;
    timedCosts:          Decimal;
    totalPrice:          Decimal;
}


function energyFactorToKWh(unit: string | undefined): Decimal | undefined {

    switch (unit)
    {
        case "kWh":
        case "KILO_WATT_HOURS":
            return new Decimal(1);

        case "Wh":
        case "WATT_HOURS":
            return new Decimal(0.001);

        default:
            return undefined;
    }

}


export function calculateBETTariffTotal(tariff:      IOCMFBonnTariff,
                                        measurement: IMeasurement): IBETTariffCosts | undefined {

    if (measurement.values.length < 2)
        return undefined;

    const values = measurement.values
                              .map(value => ({
                                  timestamp: Date.parse(value.timestamp),
                                  value:     value.value
                              }))
                              .filter(value => Number.isFinite(value.timestamp))
                              .sort((left, right) => left.timestamp - right.timestamp);

    const firstValue = values[0];
    const lastValue  = values[values.length - 1];

    if (firstValue === undefined ||
        lastValue  === undefined ||
        lastValue.timestamp <= firstValue.timestamp)
    {
        return undefined;
    }

    const durationMinutes = new Decimal(lastValue.timestamp - firstValue.timestamp).dividedBy(60_000);
    const startFee        = new Decimal(tariff.startFeeCents).dividedBy(100);
    let   chargedEnergy   = new Decimal(0);
    let   billedEnergy    = new Decimal(0);
    let   energyCosts     = new Decimal(0);
    let   billableMinutes = 0;
    let   timedCosts      = new Decimal(0);

    if (tariff.code === "001" || tariff.code === "002")
    {
        const energyFactor = energyFactorToKWh(measurement.unit);
        if (energyFactor === undefined)
            return undefined;

        chargedEnergy = lastValue.value.minus(firstValue.value).times(energyFactor);
        if (chargedEnergy.isNegative())
            return undefined;

        billedEnergy = chargedEnergy.times(1000).ceil().dividedBy(1000);
        energyCosts  = billedEnergy.times(tariff.energyFeeCentsPerKWh).dividedBy(100);

        if (tariff.code === "001")
        {
            const blockingDuration = Decimal.max(
                durationMinutes.minus(tariff.blockingFeeStartMinute),
                0
            );

            billableMinutes = blockingDuration.ceil().toNumber();
            timedCosts      = new Decimal(billableMinutes)
                                  .times(tariff.blockingFeeCentsPerMinute)
                                  .dividedBy(100);
        }
    }
    else
    {
        billableMinutes = durationMinutes.ceil().toNumber();
        timedCosts      = new Decimal(billableMinutes)
                              .times(tariff.timeFeeCentsPerMinute)
                              .dividedBy(100);
    }

    return {
        currency:            "EUR",
        startFee:            startFee,
        chargedEnergyKWh:    chargedEnergy,
        billedEnergyKWh:     billedEnergy,
        energyCosts:         energyCosts,
        durationMinutes:     durationMinutes,
        billableMinutes:     billableMinutes,
        timedCosts:          timedCosts,
        totalPrice:          startFee.plus(energyCosts).plus(timedCosts)
    };

}
