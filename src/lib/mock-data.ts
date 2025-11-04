import { OrderStage } from "@/components/ui/stage-badge";

export interface Order {
  id: string;
  orderNumber: string;
  stage: OrderStage;
  customerName: string;
  phone?: string;
  address?: string;
  city?: string;
  orderDate: string;
  estimatedDuration?: number;
  totalAmount: number;
  advanceAmount: number;
  freightAmount: number;
  balance: number;
  notes?: string;
  assignSite?: "naka" | "godown";
  processingSite?: "naka" | "godown";
  files: string[];
  timeline: TimelineEntry[];
}

export interface TimelineEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  fromStage?: OrderStage;
  toStage?: OrderStage;
}

export const mockOrders: Order[] = [
  {
    id: "1",
    orderNumber: "1000000001",
    stage: "intake",
    customerName: "Rajesh Kumar",
    phone: "+91 98765 43210",
    address: "123 MG Road, Koramangala",
    city: "Bangalore",
    orderDate: "2025-01-15",
    estimatedDuration: 5,
    totalAmount: 125000,
    advanceAmount: 50000,
    freightAmount: 5000,
    balance: 80000,
    notes: "Premium glass with UV protection required",
    files: [],
    timeline: [
      {
        id: "t1",
        timestamp: "2025-01-15T10:30:00Z",
        user: "Admin User",
        action: "Order created",
        toStage: "intake",
      },
    ],
  },
  {
    id: "2",
    orderNumber: "1000000002",
    stage: "processing",
    customerName: "Priya Sharma",
    phone: "+91 98123 45678",
    address: "456 Brigade Road",
    city: "Bangalore",
    orderDate: "2025-01-14",
    estimatedDuration: 3,
    totalAmount: 85000,
    advanceAmount: 30000,
    freightAmount: 3000,
    balance: 58000,
    assignSite: "naka",
    processingSite: "naka",
    files: [],
    timeline: [
      {
        id: "t1",
        timestamp: "2025-01-14T09:00:00Z",
        user: "Admin User",
        action: "Order created",
        toStage: "intake",
      },
      {
        id: "t2",
        timestamp: "2025-01-14T14:30:00Z",
        user: "Manager User",
        action: "Site assigned",
        fromStage: "intake",
        toStage: "assign",
      },
      {
        id: "t3",
        timestamp: "2025-01-15T11:00:00Z",
        user: "Manager User",
        action: "Processing started",
        fromStage: "assign",
        toStage: "processing",
      },
    ],
  },
  {
    id: "3",
    orderNumber: "1000000003",
    stage: "dispatch",
    customerName: "Amit Patel",
    phone: "+91 99887 76655",
    address: "789 Residency Road",
    city: "Mumbai",
    orderDate: "2025-01-12",
    estimatedDuration: 7,
    totalAmount: 250000,
    advanceAmount: 100000,
    freightAmount: 10000,
    balance: 160000,
    assignSite: "godown",
    processingSite: "godown",
    files: ["size_chart_1.pdf", "design_spec.pdf"],
    timeline: [
      {
        id: "t1",
        timestamp: "2025-01-12T08:00:00Z",
        user: "Admin User",
        action: "Order created",
        toStage: "intake",
      },
      {
        id: "t2",
        timestamp: "2025-01-12T10:30:00Z",
        user: "Manager User",
        action: "Site assigned",
        fromStage: "intake",
        toStage: "assign",
      },
      {
        id: "t3",
        timestamp: "2025-01-13T09:00:00Z",
        user: "Manager User",
        action: "Processing started",
        fromStage: "assign",
        toStage: "processing",
      },
      {
        id: "t4",
        timestamp: "2025-01-14T16:00:00Z",
        user: "Production User",
        action: "Processing completed",
        fromStage: "processing",
        toStage: "dispatch",
      },
    ],
  },
  {
    id: "4",
    orderNumber: "1000000004",
    stage: "closed",
    customerName: "Sunita Reddy",
    phone: "+91 97654 32109",
    address: "321 Indiranagar",
    city: "Bangalore",
    orderDate: "2025-01-10",
    estimatedDuration: 4,
    totalAmount: 95000,
    advanceAmount: 40000,
    freightAmount: 4000,
    balance: 59000,
    assignSite: "naka",
    processingSite: "naka",
    files: ["measurements.pdf"],
    timeline: [
      {
        id: "t1",
        timestamp: "2025-01-10T09:30:00Z",
        user: "Admin User",
        action: "Order created",
        toStage: "intake",
      },
      {
        id: "t2",
        timestamp: "2025-01-10T11:00:00Z",
        user: "Manager User",
        action: "Site assigned",
        fromStage: "intake",
        toStage: "assign",
      },
      {
        id: "t3",
        timestamp: "2025-01-11T10:00:00Z",
        user: "Manager User",
        action: "Processing started",
        fromStage: "assign",
        toStage: "processing",
      },
      {
        id: "t4",
        timestamp: "2025-01-12T15:00:00Z",
        user: "Production User",
        action: "Processing completed",
        fromStage: "processing",
        toStage: "dispatch",
      },
      {
        id: "t5",
        timestamp: "2025-01-13T08:00:00Z",
        user: "Dispatch User",
        action: "Dispatched",
        fromStage: "dispatch",
        toStage: "fitting",
      },
      {
        id: "t6",
        timestamp: "2025-01-14T17:00:00Z",
        user: "Installation User",
        action: "Installation completed",
        fromStage: "fitting",
        toStage: "closed",
      },
    ],
  },
];
