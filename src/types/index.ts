// src/types/index.ts

export interface EquipmentItem {
    id: string;
    type: 'TSCĐ' | 'CCDC';
    name: string;
    code: string;
    quantity: number;
    note: string;
    specification: string | null;
    status: string;
    originalPrice: number | null;
}

export interface ClassroomStats {
    totalEquipments: number;
    totalTSCD: number;
    totalCCDC: number;
    totalValue: number | null;
}

export interface Classroom {
    id: string;
    roomId: string;
    roomName: string;
    teacherId: string;
    teacherName: string;
    modules: string[];
    roomImage: string;
    stats: ClassroomStats;
    equipments: EquipmentItem[];
}

export interface Teacher {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    avatar: string | null;
    department: string | null;
}
