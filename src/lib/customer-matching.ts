import type { Customer, Division } from "./rcms-types.ts";

export function normalizeThaiName(name: string): string {
  return (name || "")
    .replace(
      /^(พล\.อ\.อ\.หญิง|พล\.อ\.อ\.|พล\.อ\.ท\.หญิง|พล\.อ\.ท\.|พล\.อ\.ต\.หญิง|พล\.อ\.ต\.|พล\.อ\.หญิง|พล\.อ\.|พล\.ท\.หญิง|พล\.ท\.|พล\.ต\.หญิง|พล\.ต\.|น\.อ\.หญิง|น\.อ\.|น\.ท\.หญิง|น\.ท\.|น\.ต\.หญิง|น\.ต\.|พ\.อ\.หญิง|พ\.อ\.อ\.หญิง|พ\.อ\.อ\.|พ\.อ\.ท\.หญิง|พ\.อ\.ท\.|พ\.อ\.ต\.หญิง|พ\.อ\.ต\.|พ\.อ\.|พ\.ท\.หญิง|พ\.ท\.|พ\.ต\.หญิง|พ\.ต\.|ร\.อ\.หญิง|ร\.อ\.|ร\.ท\.หญิง|ร\.ท\.|ร\.ต\.หญิง|ร\.ต\.|จ\.ส\.อ\.หญิง|จ\.ส\.อ\.|จ\.ส\.ท\.หญิง|จ\.ส\.ท\.|จ\.ส\.ต\.หญิง|จ\.ส\.ต\.|ส\.อ\.หญิง|ส\.อ\.|ส\.ท\.หญิง|ส\.ท\.|ส\.ต\.หญิง|ส\.ต\.|พล\.ต\.อ\.|พล\.ต\.ท\.|พล\.ต\.ต\.|พ\.ต\.อ\.|พ\.ต\.ท\.|พ\.ต\.ต\.|ร\.ต\.อ\.|ร\.ต\.ท\.|ร\.ต\.ต\.|ด\.ต\.|ส\.ต\.อ\.|ส\.ต\.ท\.|ส\.ต\.ต\.|ว่าที่\s*ร\.อ\.หญิง|ว่าที่\s*ร\.อ\.|ว่าที่\s*ร\.ท\.หญิง|ว่าที่\s*ร\.ท\.|ว่าที่\s*ร\.ต\.หญิง|ว่าที่\s*ร\.ต\.|ว่าที่\s*พ\.ต\.|นางสาว|น\.ส\.|นาง|นาย|คุณ|ผศ\.|รศ\.|ศ\.|ดร\.)/g,
      "",
    )
    .replace(/ผู้ประกอบการ\s*/g, "")
    .replace(/[^0-9a-zA-Zก-๙]/g, "")
    .toLowerCase();
}

export function normalizeMeterNo(meter: string): string {
  return (meter || "")
    .replace(/[^0-9a-zA-Z]/g, "")
    .replace(/^0+/, "")
    .toLowerCase();
}

export function findMatchingCustomer(
  customers: Customer[],
  meter: string | undefined,
  name: string | undefined,
  shop: string | undefined,
  division?: Division,
): Customer | undefined {
  const cleanM = (meter || "").trim();
  const normM = normalizeMeterNo(cleanM);
  const cleanN = normalizeThaiName(name || "");
  const cleanS = (shop || "").replace(/\s+/g, "").toLowerCase();

  // 0. Exact Code / ID match
  if (cleanM && /^C-\d+$/i.test(cleanM)) {
    const byCode = customers.find(
      (c) =>
        c.code.toLowerCase() === cleanM.toLowerCase() ||
        c.id.toLowerCase() === cleanM.toLowerCase(),
    );
    if (byCode) return byCode;
  }

  // 1. Exact meter match for division
  if (cleanM && cleanM.length >= 2 && cleanM !== "—" && cleanM !== "-") {
    const byExact = customers.find((c) =>
      division === "water"
        ? c.waterMeter === cleanM
        : division === "electric"
          ? c.elecMeter === cleanM
          : c.elecMeter === cleanM || c.waterMeter === cleanM,
    );
    if (byExact) return byExact;

    // Cross division check if not found
    const byCrossExact = customers.find((c) => c.elecMeter === cleanM || c.waterMeter === cleanM);
    if (byCrossExact) return byCrossExact;
  }

  // 2. Normalized meter match (ignores dashes, spaces, leading zeroes)
  if (normM && normM.length >= 2) {
    const byNormMeter = customers.find((c) => {
      const cElec = normalizeMeterNo(c.elecMeter || "");
      const cWater = normalizeMeterNo(c.waterMeter || "");
      if (division === "water") {
        return (
          cWater &&
          (cWater === normM ||
            (normM.length >= 3 && cWater.length >= 3 && (cWater.endsWith(normM) || normM.endsWith(cWater))))
        );
      }
      if (division === "electric") {
        return (
          cElec &&
          (cElec === normM ||
            (normM.length >= 3 && cElec.length >= 3 && (cElec.endsWith(normM) || normM.endsWith(cElec))))
        );
      }
      return (
        (cElec &&
          (cElec === normM ||
            (normM.length >= 3 && cElec.length >= 3 && (cElec.endsWith(normM) || normM.endsWith(cElec))))) ||
        (cWater &&
          (cWater === normM ||
            (normM.length >= 3 && cWater.length >= 3 && (cWater.endsWith(normM) || normM.endsWith(cWater)))))
      );
    });
    if (byNormMeter) return byNormMeter;
  }

  // 3. Name & Shop match
  if (cleanN && cleanN.length >= 2 && cleanS && cleanS.length >= 2) {
    const byNameAndShop = customers.find((c) => {
      const cN = normalizeThaiName(c.name || "");
      const cS = (c.shop || "").replace(/\s+/g, "").toLowerCase();
      return (
        (cN === cleanN && cS === cleanS) ||
        (cN.length >= 3 && cleanN.length >= 3 && (cN.includes(cleanN) || cleanN.includes(cN)) && cS === cleanS)
      );
    });
    if (byNameAndShop) return byNameAndShop;
  }

  // 4. Name only match
  if (cleanN && cleanN.length >= 3) {
    const byName = customers.find((c) => {
      const cN = normalizeThaiName(c.name || "");
      return cN && (cN === cleanN || (cN.length >= 4 && cleanN.length >= 4 && (cN.includes(cleanN) || cleanN.includes(cN))));
    });
    if (byName) return byName;
  }

  // 5. Specific Shop only match (ignore generic words)
  const GENERIC_SHOPS = new Set(["ร้านค้า", "ร้านอาหาร", "สนามบินเล็ก", "ทุ่งสีกัน", "ร้าน", "สวัสดิการ", "ตลาด", "ทั่วไป", "—", "-"]);
  if (cleanS && cleanS.length >= 4 && !GENERIC_SHOPS.has(cleanS)) {
    const matchingCustomers = customers.filter(
      (c) => (c.shop || "").replace(/\s+/g, "").toLowerCase() === cleanS,
    );
    if (matchingCustomers.length === 1) return matchingCustomers[0];
  }

  return undefined;
}

export type MeterCategoryFilter = "all" | "electric" | "water" | "both" | "none";

// Extract prefix/series from meter string (e.g. "72793-059" -> "72793", "20177-093" -> "20177")
export function getMeterPrefix(meter?: string): string | null {
  if (!meter) return null;
  const trimmed = meter.trim();
  if (!trimmed || trimmed === "—" || trimmed === "-") return null;
  const match = trimmed.match(/^([A-Za-z0-9]+)[-\/]/) || trimmed.match(/^([0-9]{3,6})/);
  return (match && match[1]) ? match[1] : trimmed;
}

export function getCustomerMeterCategory(c?: Customer): {
  type: "electric" | "water" | "both" | "none";
  label: string;
  shortLabel: string;
  badgeCls: string;
  elecPrefix: string | null;
  waterPrefix: string | null;
} {
  if (!c) {
    return {
      type: "none",
      label: "ไม่มีมิเตอร์",
      shortLabel: "ไม่มีมิเตอร์",
      badgeCls: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
      elecPrefix: null,
      waterPrefix: null,
    };
  }
  let effectiveElec = c.elecMeter;
  let effectiveWater = c.waterMeter;
  // 20177, 72793, 50365, 38944 are ELECTRICITY meter series
  if (
    effectiveWater &&
    (effectiveWater.startsWith("20177-") ||
      effectiveWater.startsWith("72793-") ||
      effectiveWater.startsWith("50365-") ||
      effectiveWater.startsWith("38944-"))
  ) {
    if (!effectiveElec || effectiveElec === "—" || effectiveElec === "-") {
      effectiveElec = effectiveWater;
      effectiveWater = undefined;
    } else if (effectiveWater.startsWith("20177-") || effectiveWater === effectiveElec) {
      effectiveWater = undefined;
    }
  }

  const hasElec = Boolean(
    effectiveElec &&
      effectiveElec.trim() !== "" &&
      effectiveElec !== "—" &&
      effectiveElec !== "-",
  );
  const hasWater = Boolean(
    effectiveWater &&
      effectiveWater.trim() !== "" &&
      effectiveWater !== "—" &&
      effectiveWater !== "-",
  );

  const elecPrefix = hasElec ? getMeterPrefix(effectiveElec) : null;
  const waterPrefix = hasWater ? getMeterPrefix(effectiveWater) : null;

  if (hasElec && hasWater) {
    return {
      type: "both",
      label: "⚡💧 ไฟฟ้าและน้ำประปา",
      shortLabel: "2 ระบบ",
      badgeCls:
        "border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-300",
      elecPrefix,
      waterPrefix,
    };
  }
  if (hasElec) {
    return {
      type: "electric",
      label: "⚡ ค่าไฟฟ้า",
      shortLabel: "ไฟฟ้า",
      badgeCls:
        "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
      elecPrefix,
      waterPrefix: null,
    };
  }
  if (hasWater) {
    return {
      type: "water",
      label: "💧 ค่าน้ำประปา",
      shortLabel: "น้ำประปา",
      badgeCls:
        "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400",
      elecPrefix: null,
      waterPrefix,
    };
  }
  return {
    type: "none",
    label: "⚪ ยังไม่มีมิเตอร์",
    shortLabel: "ไม่มีมิเตอร์",
    badgeCls:
      "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
    elecPrefix: null,
    waterPrefix: null,
  };
}
