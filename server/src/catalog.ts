/**
 * Catálogo fijo según especificación de producto v1.
 * No recalcular capacidades por camas. No inventar tarifas de Real del Sol.
 */

export type HotelId = "posada-real" | "isla-coral" | "real-del-sol";

export type CategoryRecord = {
  id: string;
  hotelId: HotelId;
  name: string;
  distribution: string;
  adults: number;
  kitchen: boolean;
  tariffBaseMxn: number;
  roomAmenities: string;
};

export type HotelRecord = {
  id: HotelId;
  name: string;
  shortName: string;
  inventoryRef: number | null;
  inventoryNote: string;
  kidsPolicy: string;
  amenities: string[];
  description: string;
  phrase: string | null;
  sellable: boolean;
  comingSoon: boolean;
  taxNote: string;
  disclaimer: string;
};

export const TAX_NOTE =
  "Precios en MXN por alojamiento por noche (base). Impuestos por confirmar — no se calculan en esta fase.";

export const TARIFF_DISCLAIMER =
  "Tarifas sujetas a cambio sin previo aviso. Las tarifas de lista no son el piso de subasta ni un descuento permanente.";

export const HOTELS: HotelRecord[] = [
  {
    id: "posada-real",
    name: "Hotel Posada Real",
    shortName: "Posada Real",
    inventoryRef: 64,
    inventoryNote:
      "Inventario de referencia ~64 habitaciones — CONFIRMAR antes de ventas reales. Fase 1 usa cupos manuales, no Cloudbeds.",
    kidsPolicy:
      "Hasta 2 menores gratis, menores de 7 años (no se asume inclusive de 7 hasta confirmación).",
    amenities: [
      "Alberca",
      "Chapoteadero con tobogán",
      "Jacuzzi",
      "Estacionamiento",
      "A ~60 m de la playa",
    ],
    description:
      "Hotel principal de Grupo Posada Real en Rincón de Guayabitos, Nayarit. Solo se venden cupos y fechas que el administrador publique; no hay descuento permanente a todo el inventario.",
    phrase: null,
    sellable: true,
    comingSoon: false,
    taxNote: TAX_NOTE,
    disclaimer: TARIFF_DISCLAIMER,
  },
  {
    id: "isla-coral",
    name: "Isla Coral Posada Real 2",
    shortName: "Isla Coral",
    inventoryRef: 55,
    inventoryNote:
      "Inventario de referencia ~55 bungalows — CONFIRMAR. Fase 1 usa cupos manuales, no Cloudbeds.",
    kidsPolicy: "Hasta 2 menores gratis de 0 a 7 años inclusive, además de 4 adultos.",
    amenities: [
      "Baño privado",
      "Cocina",
      "TV",
      "Internet",
      "Comedor",
      "Aire acondicionado",
      "Balcón",
    ],
    description:
      "Bungalows nuevos, diseño moderno, cálido y familiar. En esta plataforma no se activan tarifas por temporada, mínimos de noches, anticipos ni promoción de 4ª noche gratis (no ratificadas).",
    phrase: "Un lugar para descansar",
    sellable: true,
    comingSoon: false,
    taxNote: TAX_NOTE,
    disclaimer: TARIFF_DISCLAIMER,
  },
  {
    id: "real-del-sol",
    name: "Hotel Real del Sol",
    shortName: "Real del Sol",
    inventoryRef: 23,
    inventoryNote:
      "Antecedentes ~23 habitaciones / 3 pisos / ~80 m de playa — CONFIRMAR. Tarifario, categorías, capacidades y política de menores: PENDIENTES.",
    kidsPolicy: "Pendiente de datos reales. No se inventa política de menores.",
    amenities: ["A ~80 m de la playa (dato de antecedentes, por confirmar)"],
    description:
      "Visible solo como informativo / próximamente. No se aceptan compras ni subastas hasta contar con datos reales. Cualquier precio de demos anteriores es ilustrativo y no aplica aquí.",
    phrase: null,
    sellable: false,
    comingSoon: true,
    taxNote: "Sin tarifario publicado en esta plataforma.",
    disclaimer: "No vendible en fase 1.",
  },
];

export const CATEGORIES: CategoryRecord[] = [
  {
    id: "pr-hab-2",
    hotelId: "posada-real",
    name: "Habitación para 2",
    distribution: "1 cama matrimonial",
    adults: 2,
    kitchen: false,
    tariffBaseMxn: 1300,
    roomAmenities: "Aire acondicionado, TV por cable, ventilador de techo. Sin cocina.",
  },
  {
    id: "pr-hab-4",
    hotelId: "posada-real",
    name: "Habitación para 4",
    distribution: "2 camas matrimoniales",
    adults: 4,
    kitchen: false,
    tariffBaseMxn: 1600,
    roomAmenities: "Aire acondicionado, TV por cable, ventilador de techo. Sin cocina.",
  },
  {
    id: "pr-hab-5",
    hotelId: "posada-real",
    name: "Habitación para 5",
    distribution: "2 camas matrimoniales + litera individual",
    adults: 5,
    kitchen: false,
    tariffBaseMxn: 1750,
    roomAmenities: "Aire acondicionado, TV por cable, ventilador de techo. Sin cocina.",
  },
  {
    id: "pr-hab-6",
    hotelId: "posada-real",
    name: "Habitación para 6",
    distribution: "3 camas matrimoniales",
    adults: 6,
    kitchen: false,
    tariffBaseMxn: 2000,
    roomAmenities: "Aire acondicionado, TV por cable, ventilador de techo. Sin cocina.",
  },
  {
    id: "pr-hab-7",
    hotelId: "posada-real",
    name: "Habitación para 7",
    distribution: "3 camas matrimoniales + litera individual",
    adults: 7,
    kitchen: false,
    tariffBaseMxn: 2150,
    roomAmenities: "Aire acondicionado, TV por cable, ventilador de techo. Sin cocina.",
  },
  {
    id: "pr-bung-4",
    hotelId: "posada-real",
    name: "Bungalow para 4",
    distribution: "2 camas matrimoniales",
    adults: 4,
    kitchen: true,
    tariffBaseMxn: 1800,
    roomAmenities: "Cocina equipada, aire acondicionado, TV por cable, ventilador de techo.",
  },
  {
    id: "pr-bung-6",
    hotelId: "posada-real",
    name: "Bungalow para 6",
    distribution: "3 camas matrimoniales",
    adults: 6,
    kitchen: true,
    tariffBaseMxn: 2100,
    roomAmenities: "Cocina equipada, aire acondicionado, TV por cable, ventilador de techo.",
  },
  {
    id: "pr-bung-8",
    hotelId: "posada-real",
    name: "Bungalow 2 recámaras para 8",
    distribution: "4 camas matrimoniales",
    adults: 8,
    kitchen: true,
    tariffBaseMxn: 2700,
    roomAmenities: "Cocina equipada, aire acondicionado, TV por cable, ventilador de techo.",
  },
  {
    id: "ic-bung-4",
    hotelId: "isla-coral",
    name: "Bungalow",
    distribution: "2 camas queen",
    adults: 4,
    kitchen: true,
    tariffBaseMxn: 2050,
    roomAmenities:
      "Baño privado, cocina, TV, internet, comedor, aire acondicionado, balcón. Capacidad: 4 adultos + hasta 2 menores (0 a 7 inclusive).",
  },
];

export function hotelById(id: string): HotelRecord | undefined {
  return HOTELS.find((h) => h.id === id);
}

export function categoryById(id: string): CategoryRecord | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

export function categoriesForHotel(hotelId: string): CategoryRecord[] {
  return CATEGORIES.filter((c) => c.hotelId === hotelId);
}

export function assertSellableHotel(hotelId: string): HotelRecord {
  const hotel = hotelById(hotelId);
  if (!hotel) {
    throw new Error(`Hotel desconocido: ${hotelId}`);
  }
  if (!hotel.sellable || hotel.comingSoon) {
    const err = new Error(
      `${hotel.name} no admite compra ni subasta en esta fase (próximamente / datos pendientes).`,
    );
    err.name = "NotSellableError";
    throw err;
  }
  return hotel;
}
