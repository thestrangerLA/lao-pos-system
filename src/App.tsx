import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  BarChart3, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  ChevronRight, 
  CreditCard, 
  Banknote, 
  QrCode, 
  CheckCircle2, 
  AlertCircle,
  X,
  History,
  TrendingUp,
  TrendingDown,
  FileText,
  PlusCircle,
  Settings,
  LogOut,
  Save,
  RefreshCw,
  Printer,
  ChevronDown,
  ChevronUp,
  Upload,
  Image as ImageIcon,
  Wallet,
  Landmark,
  Users,
  Truck,
  ArrowRightLeft,
  ArrowLeft,
  PiggyBank,
  Equal,
  Calendar,
  UserPlus,
  UserMinus,
  Scale,
  RefreshCcw,
  Edit,
  Camera,
  Pill,
  Check,
  LayoutGrid,
  List
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  isWithinInterval,
  getYear,
  getMonth,
  setMonth,
  startOfDay
} from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { cn } from '@/src/lib/utils';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  getDocFromServer,
  writeBatch,
  getDocs
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { db, auth } from './firebase';
import firebaseConfig from '../firebase-applet-config.json';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Types ---
interface Product {
  id: string;
  name: string;
  price: number;
  cost: number;
  costTHB: number;
  wholesalePrice: number;
  category: string;
  stock: number;
  image?: string;
  size?: string;
  collectionName?: 'stockItems' | 'applianceStockItems';
}

interface CartItem extends Product {
  quantity: number;
}

interface Sale {
  id: string;
  timestamp: number;
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'qr';
}

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  date: string;
  amount: number;
  category: string;
  businessType: string;
  note: string;
  timestamp: number;
}

interface AccountingConfig {
  bankTransfer: number;
  initialCapital: number;
  shippingOwed: number;
  circulatingMoney: number;
}

interface TransportEntry {
  id: string;
  type: 'ANS' | 'HAL' | 'MX' | 'COD';
  detail?: string;
  cost?: number;
  quantity?: number;
  amount?: number;
  finished: boolean;
  date: number; // Timestamp
  productId?: string;
}

interface DebtorEntry {
  id: string;
  type: 'debtor' | 'creditor';
  amount: number;
  description: string;
  date: any; // Firestore Timestamp or Date
  isPaid: boolean;
  createdAt: any;
}

interface MedicineDebtorEntry {
  id: string;
  orderNo: number; // ລຳດັບ
  name: string; // ລາຍການ/ຊື່ຢາ
  note: string; // ໝາຍເຫດ
  cost: number; // ຕົ້ນທຶນ
  sellingPrice: number; // ລາຄາຂາຍ
  isPaid: boolean; // ສຳເລັດ
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  createdAt: any;
}

// --- Mock Data ---
const INITIAL_PRODUCTS: Product[] = [
  { id: '1', name: 'ນ້ຳດື່ມສິງ 600ml', price: 10000, cost: 7000, costTHB: 15, wholesalePrice: 8500, category: 'ອາຫານ', stock: 120 },
  { id: '2', name: 'ເບຍລາວ ກະປ໋ອງ', price: 15000, cost: 11000, costTHB: 22, wholesalePrice: 13000, category: 'ອາຫານ', stock: 85 },
  { id: '3', name: 'ເຂົ້າຈີ່ຝຣັ່ງ', price: 5000, cost: 3000, costTHB: 6, wholesalePrice: 4000, category: 'ອາຫານ', stock: 50 },
  { id: '4', name: 'ສະບູ່ລັກ', price: 12000, cost: 8500, costTHB: 18, wholesalePrice: 10000, category: 'ເຄື່ອງໃຊ້', stock: 40 },
  { id: '5', name: 'ຢາສີຟັນຄອນເກດ', price: 25000, cost: 18000, costTHB: 38, wholesalePrice: 22000, category: 'ເຄື່ອງໃຊ້', stock: 30 },
  { id: '6', name: 'ປຸ໋ຍສູດ 15-15-15', price: 450000, cost: 380000, costTHB: 800, wholesalePrice: 420000, category: 'ປຸ໋ຍ', stock: 50 },
  { id: '7', name: 'ຢາຂ້າຫຍ້າ', price: 120000, cost: 95000, costTHB: 200, wholesalePrice: 110000, category: 'ຢາພືດ', stock: 40 },
  { id: '8', name: 'ແນວພັນເຂົ້າຫອມມະລິ', price: 85000, cost: 65000, costTHB: 140, wholesalePrice: 75000, category: 'ແນວພັນ', stock: 100 },
  { id: '9', name: 'ຢາສີດປວກສັດ', price: 45000, cost: 32000, costTHB: 65, wholesalePrice: 40000, category: 'ຢາສັດ', stock: 20 },
  { id: '10', name: 'ເຂົ້າສານ 5kg', price: 65000, cost: 55000, costTHB: 115, wholesalePrice: 60000, category: 'ເຂົ້າ', stock: 60 },
];

const AGRICULTURE_CATEGORIES = ['ທັງໝົດ', 'ເຄື່ອງໃຊ້', 'ອາຫານ', 'ຢາພືດ', 'ຢາສັດ', 'ວິຕາມິນ', 'ຢາໄກ່', 'ສັດນໍ້າ', 'ອປກ ສັດ', 'ປຸ໋ຍ', 'ເຂົ້າ', 'ແນວພັນ', 'ເຄື່ອງຄົວ', 'ເຄື່ອງຍ່ອຍ'];
const SPORTS_CATEGORIES = ['ທັງໝົດ', 'ຊຸດກິລາ', 'ເກີບກິລາ', 'ບານເຕະ', 'ອຸປະກອນກິລາ', 'ຖົງຕີນ & ອຸປະກອນເສີມ', 'ຖ້ວຍລາງວັນ & ຫຼຽນ', 'ອື່ນໆ'];
const ACCOUNTING_CATEGORIES = ['ທົ່ວໄປ', 'ຄ່າຍາ', 'ຄ່າອາຫານ', 'ຄ່າຂົນສົ່ງ', 'ຄ່າແຮງງານ', 'ອື່ນໆ'];
const BUSINESS_TYPES = [
  { id: 'agriculture', name: 'ກະສິກຳ (Agriculture)' },
  { id: 'retail', name: 'ຂາຍຍ່ອຍ (Retail)' },
  { id: 'other', name: 'ອື່ນໆ (Other)' }
];

// --- Helper Components ---
const Card = ({ children, className, ...props }: { children: React.ReactNode; className?: string; [key: string]: any }) => (
  <div className={cn("bg-[#1e1e2e]/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6", className)} {...props}>
    {children}
  </div>
);

const Button = ({ 
  children, 
  variant = 'primary', 
  className, 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) => {
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20",
    secondary: "bg-white/5 hover:bg-white/10 text-white border border-white/10",
    danger: "bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20",
    ghost: "bg-transparent hover:bg-white/5 text-white/70 hover:text-white"
  };
  
  return (
    <button 
      className={cn("px-4 py-2 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none", variants[variant], className)}
      {...props}
    >
      {children}
    </button>
  );
};

const getLocalDateString = (d: Date = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// --- Main App ---
export default function App() {
  const [currentShop, setCurrentShop] = useState<'agriculture' | 'sports'>(() => {
    return (localStorage.getItem('currentShop') as 'agriculture' | 'sports') || 'agriculture';
  });

  const getCol = (name: string) => {
    return currentShop === 'agriculture' ? name : `sports_${name}`;
  };

  const handleShopChange = (shop: 'agriculture' | 'sports') => {
    setCurrentShop(shop);
    localStorage.setItem('currentShop', shop);
    setCart([]); // Clear cart to prevent cross-shop items
    setSelectedCategory('ທັງໝົດ');
    setInventoryFilterCategory(null);
    if (shop === 'sports' && (activeTab === 'debtors' || activeTab === 'medicine_debtors')) {
      setActiveTab('pos');
    }
  };

  const [user, setUser] = useState<User | null>({
    uid: 'guest-user',
    email: 'guest@system.pos',
    displayName: 'Guest System',
    photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=POS'
  } as any);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pos' | 'inventory' | 'reports' | 'accounting' | 'cod' | 'debtors' | 'medicine_debtors'>('pos');
  const [mobilePosActiveTab, setMobilePosActiveTab] = useState<'products' | 'cart'>('products');
  const [inventoryViewMode, setInventoryViewMode] = useState<'list' | 'grid'>('grid');
  const [stockProducts, setStockProducts] = useState<Product[]>([]);
  const [applianceProducts, setApplianceProducts] = useState<Product[]>([]);
  const products = useMemo(() => {
    return [...stockProducts, ...applianceProducts];
  }, [stockProducts, applianceProducts]);
  const categories = useMemo(() => {
    return currentShop === 'agriculture' ? AGRICULTURE_CATEGORIES : SPORTS_CATEGORIES;
  }, [currentShop]);
  const [inventoryFilterCategory, setInventoryFilterCategory] = useState<string | null>(null);
  const [inventorySearchTerm, setInventorySearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transportEntries, setTransportEntries] = useState<TransportEntry[]>([]);
  const [debtorEntries, setDebtorEntries] = useState<DebtorEntry[]>([]);
  const [selectedDebtorMonth, setSelectedDebtorMonth] = useState<string>('all');

  const [debtorsSubTab, setDebtorsSubTab] = useState<'general' | 'medicine'>('general');
  const [medicineEntries, setMedicineEntries] = useState<MedicineDebtorEntry[]>([]);
  const [selectedMedicineMonth, setSelectedMedicineMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  // Medicine entry form states
  const [medFormOrderNo, setMedFormOrderNo] = useState<string>('1');
  const [medFormName, setMedFormName] = useState<string>('');
  const [medFormNote, setMedFormNote] = useState<string>('');
  const [medFormCost, setMedFormCost] = useState<string>('0');
  const [medFormSellingPrice, setMedFormSellingPrice] = useState<string>('0');
  const [medFormDate, setMedFormDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Medicine item editing states
  const [editingMedicineId, setEditingMedicineId] = useState<string | null>(null);
  const [editingMedicineCost, setEditingMedicineCost] = useState<string>('0');
  const [editingMedicineSellingPrice, setEditingMedicineSellingPrice] = useState<string>('0');
  const [editingMedicineName, setEditingMedicineName] = useState<string>('');
  const [editingMedicineNote, setEditingMedicineNote] = useState<string>('');

  // Expand states for dates and specific order numbers under each date
  const [expandedMedicineDates, setExpandedMedicineDates] = useState<Record<string, boolean>>({});
  const [expandedMedicineOrders, setExpandedMedicineOrders] = useState<Record<string, boolean>>({});

  const filteredMedicineEntries = useMemo(() => {
    return medicineEntries.filter(entry => entry.month === selectedMedicineMonth);
  }, [medicineEntries, selectedMedicineMonth]);

  const groupedMedicineByDate = useMemo(() => {
    // Group by date
    const groupedByDate: Record<string, Record<number, MedicineDebtorEntry[]>> = {};
    
    filteredMedicineEntries.forEach(entry => {
      const date = entry.date;
      const orderNo = entry.orderNo;
      if (!groupedByDate[date]) {
        groupedByDate[date] = {};
      }
      if (!groupedByDate[date][orderNo]) {
        groupedByDate[date][orderNo] = [];
      }
      groupedByDate[date][orderNo].push(entry);
    });

    // Sort dates descending
    const dateList = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));
    
    return dateList.map(date => {
      const ordersObj = groupedByDate[date];
      // Sort orders within that date ascending
      const orderNos = Object.keys(ordersObj).map(Number).sort((a, b) => a - b);
      
      const orders = orderNos.map(orderNo => {
        const items = ordersObj[orderNo];
        const totalCost = items.reduce((sum, item) => sum + item.cost, 0);
        const totalSellingPrice = items.reduce((sum, item) => sum + item.sellingPrice, 0);
        const totalProfit = totalSellingPrice - totalCost;
        const totalProfit40 = totalProfit * 0.4;
        const totalProfit60 = totalProfit * 0.6;
        const totalPayRemaining = totalCost + totalProfit40; // cost + 40% profit = price - 60% profit
        
        // Order is paid if all of its items are paid
        const isOrderPaid = items.every(item => item.isPaid);
        
        return {
          orderNo,
          items,
          totalCost,
          totalSellingPrice,
          totalProfit,
          totalProfit40,
          totalProfit60,
          totalPayRemaining,
          isPaid: isOrderPaid
        };
      });

      const totalOrders = orders.length;
      const completedOrders = orders.filter(o => o.isPaid).length;
      const remainingAmount = orders
        .flatMap(o => o.items)
        .filter(item => !item.isPaid)
        .reduce((sum, item) => sum + (item.cost + (item.sellingPrice - item.cost) * 0.4), 0);

      return {
        date,
        orders,
        totalOrders,
        completedOrders,
        remainingAmount
      };
    });
  }, [filteredMedicineEntries]);

  const filteredDebtorEntries = useMemo(() => {
    if (selectedDebtorMonth === 'all') {
      return debtorEntries;
    }
    return debtorEntries.filter(e => e.date.startsWith(selectedDebtorMonth));
  }, [debtorEntries, selectedDebtorMonth]);

  const [selectedCodCategory, setSelectedCodCategory] = useState<'ANS' | 'HAL' | 'MX' | 'COD' | null>(null);
  const [codChartType, setCodChartType] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedAccountingMonth, setSelectedAccountingMonth] = useState(new Date().toISOString().slice(0, 7));
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);

  const toggleDate = (dateKey: string) => {
    setExpandedDates(prev => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  const toggleMedicineDate = (date: string) => {
    setExpandedMedicineDates(prev => ({ 
      ...prev, 
      [date]: prev[date] === false ? true : false 
    }));
  };

  const toggleMedicineOrder = (orderKey: string) => {
    setExpandedMedicineOrders(prev => ({ 
      ...prev, 
      [orderKey]: prev[orderKey] === false ? true : false 
    }));
  };

  const accountingDailySummaries = useMemo(() => {
    const grouped: Record<string, { date: string, entries: (Transaction | DebtorEntry | MedicineDebtorEntry)[], totalIncome: number, totalExpense: number }> = {};
    
    // Filter by selected month
    const filteredTransactions = transactions.filter(tx => {
      if (tx.id.startsWith('TX-TR-')) return false;
      return tx.date.startsWith(selectedAccountingMonth);
    });

    const filteredDebtors = debtorEntries.filter(e => {
      return !e.isPaid && e.date.startsWith(selectedAccountingMonth);
    });

    const filteredMedicine = medicineEntries.filter(e => {
      return e.date.startsWith(selectedAccountingMonth);
    });

    filteredTransactions.forEach(tx => {
      const dateKey = tx.date;
      if (!grouped[dateKey]) {
        grouped[dateKey] = { date: dateKey, entries: [], totalIncome: 0, totalExpense: 0 };
      }
      grouped[dateKey].entries.push(tx);
      if (tx.type === 'income') grouped[dateKey].totalIncome += tx.amount;
      else grouped[dateKey].totalExpense += tx.amount;
    });

    if (currentShop !== 'sports') {
      filteredDebtors.forEach(debt => {
        const dateKey = debt.date;
        if (!grouped[dateKey]) {
          grouped[dateKey] = { date: dateKey, entries: [], totalIncome: 0, totalExpense: 0 };
        }
        grouped[dateKey].entries.push(debt);
      });

      filteredMedicine.forEach(med => {
        const dateKey = med.date;
        if (!grouped[dateKey]) {
          grouped[dateKey] = { date: dateKey, entries: [], totalIncome: 0, totalExpense: 0 };
        }
        grouped[dateKey].entries.push(med);
      });
    }

    return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, debtorEntries, medicineEntries, selectedAccountingMonth, currentShop]);

  const [accountingConfig, setAccountingConfig] = useState<AccountingConfig>({
    bankTransfer: 45298000,
    initialCapital: 112500000,
    shippingOwed: 5985000,
    circulatingMoney: 47915987.2
  });
  const [editingConfigField, setEditingConfigField] = useState<keyof AccountingConfig | null>(null);
  const [cashCalc, setCashCalc] = useState<Record<string, number>>({
    '100000': 0, '50000': 0, '20000': 0, '10000': 0, '5000': 0, '2000': 0, '1000': 0, 
    'baht': 0, 'bahtRate': 700, 'usd': 0, 'usdRate': 22000
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ທັງໝົດ');
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [discount, setDiscount] = useState<number>(0);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleStartCamera = async () => {
    setCameraError(null);
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      });
      streamRef.current = stream;
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError("ບໍ່ສາມາດເປີດກ້ອງຖ່າຍຮູບໄດ້. ກະລຸນາອະນຸຍາດການເຂົ້າເຖິງກ້ອງຖ່າຍຮູບ.");
    }
  };

  const handleStopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
    setCameraError(null);
  };

  const handleCapturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setUploadedImage(dataUrl);
        handleStopCamera();
      }
    }
  };

  useEffect(() => {
    if (!isProductModalOpen) {
      handleStopCamera();
    }
  }, [isProductModalOpen]);

  const [isTransportModalOpen, setIsTransportModalOpen] = useState(false);
  const [transportModalData, setTransportModalData] = useState({
    type: 'ANS' as 'ANS' | 'HAL' | 'MX' | 'COD',
    date: new Date().toISOString().split('T')[0],
    items: [{ id: Date.now(), detail: '', cost: 0, quantity: 1, amount: 0, productId: '' }]
  });

  const handleAddTransportLine = () => {
    setTransportModalData(prev => ({
      ...prev,
      items: [...prev.items, { id: Date.now(), detail: '', cost: 0, quantity: 1, amount: 0, productId: '' }]
    }));
  };

  const handleRemoveTransportLine = (id: number) => {
    setTransportModalData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id)
    }));
  };

  const handleUpdateTransportLine = (id: number, updates: any) => {
    setTransportModalData(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === id ? { ...item, ...updates } : item)
    }));
  };

  const handleSaveTransportBatch = async () => {
    if (!user) return;
    const batch = writeBatch(db);
    const newEntries: TransportEntry[] = [];
    transportModalData.items.forEach((item, index) => {
      const entryId = `TR-${Date.now()}-${index}`;
      const newEntry: TransportEntry = {
        id: entryId,
        type: transportModalData.type,
        detail: item.detail || (transportModalData.type === 'COD' ? 'COD' : 'ຂົນສົ່ງ'),
        cost: item.cost,
        quantity: item.quantity,
        amount: item.amount,
        finished: false,
        date: new Date(transportModalData.date).getTime(),
        productId: item.productId || ''
      };
      batch.set(doc(db, 'transportEntries', entryId), newEntry);
      newEntries.push(newEntry);
    });
    
    try {
      await batch.commit();
      
      setIsTransportModalOpen(false);
      setTransportModalData({
        type: 'ANS',
        date: new Date().toISOString().split('T')[0],
        items: [{ id: Date.now(), detail: '', cost: 0, quantity: 1, amount: 0, productId: '' }]
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'transportEntries/batch');
    }
  };

  // --- Auth & Data Sync ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
      } else {
        setUser({
          uid: 'guest-user',
          email: 'guest@system.pos',
          displayName: 'Guest System',
          photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=POS'
        } as any);
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Test connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, getCol('stockItems'), 'connection-test'));
        console.log("Firebase connected successfully to database:", firebaseConfig.firestoreDatabaseId || '(default)');
      } catch (error) {
        console.error("Firebase connection error:", error);
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration or internet connection.");
        }
      }
    };
    testConnection();

    // Listen to Products (stockItems)
    const unsubProducts = onSnapshot(collection(db, getCol('stockItems')), (snapshot) => {
      if (snapshot.empty) {
        const isSeeded = localStorage.getItem(`seeded_${getCol('stockItems')}`);
        if (!isSeeded) {
          INITIAL_PRODUCTS.forEach(async (p) => {
            const productRef = doc(db, getCol('stockItems'), p.id);
            await setDoc(productRef, {
              id: p.id,
              name: p.name,
              sellingPrice: p.price,
              costPrice: p.cost,
              costPriceBaht: p.costTHB,
              wholesalePrice: p.wholesalePrice,
              category: p.category,
              currentStock: p.stock,
              image: ''
            });
          });
          localStorage.setItem(`seeded_${getCol('stockItems')}`, 'true');
        } else {
          setStockProducts([]);
        }
        return;
      }
      const items = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.name || '',
          price: d.sellingPrice ?? d.price ?? 0,
          cost: d.costPrice ?? d.cost ?? 0,
          costTHB: d.costPriceBaht ?? d.costTHB ?? 0,
          wholesalePrice: d.wholesalePrice || 0,
          category: d.category || '',
          stock: d.currentStock ?? d.stock ?? 0,
          image: d.image || '',
          size: d.size || '',
          collectionName: 'stockItems'
        } as Product;
      });
      setStockProducts(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, getCol('stockItems'));
    });

    // Listen to Appliance Products (applianceStockItems)
    const unsubApplianceProducts = onSnapshot(collection(db, getCol('applianceStockItems')), (snapshot) => {
      const items = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.name || '',
          price: d.sellingPrice ?? d.price ?? 0,
          cost: d.costPrice ?? d.cost ?? 0,
          costTHB: d.costPriceBaht ?? d.costTHB ?? 0,
          wholesalePrice: d.wholesalePrice || 0,
          category: 'ເຄື່ອງຄົວ',
          stock: d.currentStock ?? d.stock ?? 0,
          image: d.image || '',
          size: d.size || '',
          collectionName: 'applianceStockItems'
        } as Product;
      });
      setApplianceProducts(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, getCol('applianceStockItems'));
    });

    // Listen to Sales
    const unsubSales = onSnapshot(query(collection(db, getCol('sales')), orderBy('timestamp', 'desc')), (snapshot) => {
      const items = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          timestamp: data.timestamp?.toMillis ? data.timestamp.toMillis() : data.timestamp
        } as Sale;
      });
      setSales(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, getCol('sales'));
    });

    // Listen to Transactions (Using agriculture-transactions to match user screenshot)
    const unsubTransactions = onSnapshot(query(collection(db, getCol('agriculture-transactions')), orderBy('date', 'desc')), (snapshot) => {
      const items = snapshot.docs.map(doc => {
        const data = doc.data();
        let dateStr = '';
        
        if (data.date?.toDate) {
          dateStr = format(data.date.toDate(), 'yyyy-MM-dd');
        } else if (typeof data.date === 'number') {
          dateStr = format(new Date(data.date), 'yyyy-MM-dd');
        } else if (data.date instanceof Date) {
          dateStr = format(data.date, 'yyyy-MM-dd');
        } else if (typeof data.date === 'string') {
          dateStr = data.date;
        }
        
        return { 
          id: doc.id, 
          type: data.type || 'income',
          amount: data.amount || 0,
          date: dateStr,
          note: data.description || data.note || '',
          category: data.category || 'ທົ່ວໄປ',
          businessType: data.businessType || 'agriculture',
          timestamp: data.date?.toMillis ? data.date.toMillis() : Date.now()
        } as Transaction;
      });
      setTransactions(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, getCol('agriculture-transactions'));
    });

    // Listen to Config
    const unsubConfig = onSnapshot(doc(db, getCol('config'), 'accounting'), (doc) => {
      if (doc.exists()) {
        setAccountingConfig(doc.data() as AccountingConfig);
      } else {
        setAccountingConfig({
          bankTransfer: 0,
          initialCapital: 0,
          shippingOwed: 0,
          circulatingMoney: 0
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `${getCol('config')}/accounting`);
    });

    // Listen to Transport Entries
    const unsubTransport = onSnapshot(query(collection(db, getCol('transportEntries')), orderBy('date', 'desc')), (snapshot) => {
      const items = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          date: data.date?.toMillis ? data.date.toMillis() : (data.date instanceof Date ? data.date.getTime() : (typeof data.date === 'string' ? new Date(data.date).getTime() : data.date))
        } as TransportEntry;
      });
      setTransportEntries(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, getCol('transportEntries'));
    });

    // Listen to Cash Calculator State
    const unsubCashCalc = onSnapshot(doc(db, getCol('cashCalculatorState'), 'latest'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.counts) {
          setCashCalc(data.counts);
        }
      } else {
        setCashCalc({
          '100000': 0, '50000': 0, '20000': 0, '10000': 0, '5000': 0, '2000': 0, '1000': 0, 
          'baht': 0, 'bahtRate': 700, 'usd': 0, 'usdRate': 22000
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `${getCol('cashCalculatorState')}/latest`);
    });

    // Listen to Debtors/Creditors from existing collection
    const unsubDebtors = onSnapshot(query(collection(db, getCol('debtorCreditorEntries')), orderBy('date', 'desc')), (snapshot) => {
      const items = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          date: data.date?.toDate ? data.date.toDate().toISOString().split('T')[0] : (data.date instanceof Date ? data.date.toISOString().split('T')[0] : data.date)
        } as DebtorEntry;
      });
      setDebtorEntries(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, getCol('debtorCreditorEntries'));
    });

    // Listen to Medicine Debtors collection
    const unsubMedicineDebtors = onSnapshot(query(collection(db, getCol('medicineDebtors')), orderBy('createdAt', 'desc')), (snapshot) => {
      const items = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data
        } as MedicineDebtorEntry;
      });
      setMedicineEntries(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, getCol('medicineDebtors'));
    });

    return () => {
      unsubProducts();
      unsubApplianceProducts();
      unsubSales();
      unsubTransactions();
      unsubConfig();
      unsubTransport();
      unsubCashCalc();
      unsubDebtors();
      unsubMedicineDebtors();
    };
  }, [user, currentShop]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  // --- Inventory Management Logic ---
  const handleOpenProductModal = (product?: Product) => {
    setEditingProduct(product || null);
    setUploadedImage(product?.image || null);
    setIsProductModalOpen(true);
  };

  const compressImage = (base64Str: string, maxWidth = 600, maxHeight = 600): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compress to JPEG with 0.7 quality
      };
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        // Compress and resize
        const compressed = await compressImage(base64);
        setUploadedImage(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    
    const formData = new FormData(e.currentTarget);
    const productData = {
      name: formData.get('name') as string,
      sellingPrice: Number(formData.get('price')),
      costPrice: Number(formData.get('cost')),
      costPriceBaht: Number(formData.get('costTHB')),
      wholesalePrice: Number(formData.get('wholesalePrice')),
      category: formData.get('category') as string,
      currentStock: Math.max(0, Number(formData.get('stock'))),
      image: uploadedImage || '',
      size: formData.get('size') as string || '',
    };

    const colName = editingProduct?.collectionName || 
                    (((productData.category || '').trim() === 'ເຄື່ອງຄົວ') ? 'applianceStockItems' : 'stockItems');

    if (colName === 'applianceStockItems') {
      productData.category = 'ເຄື່ອງຄົວ';
    }

    try {
      if (editingProduct) {
        const productRef = doc(db, getCol(colName), editingProduct.id);
        await updateDoc(productRef, productData);
      } else {
        const productRef = doc(collection(db, getCol(colName)));
        await setDoc(productRef, { ...productData, id: productRef.id });
      }
      setIsProductModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, getCol(colName));
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!user) return;
    const targetProduct = products.find(p => p.id === id);
    const colName = targetProduct?.collectionName || 'stockItems';
    try {
      await deleteDoc(doc(db, getCol(colName), id));
      setCart(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${getCol(colName)}/${id}`);
    }
  };

  const handleDeleteAllProducts = async () => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      
      const stockRef = collection(db, getCol('stockItems'));
      const stockSnap = await getDocs(stockRef);
      stockSnap.forEach((doc) => {
        batch.delete(doc.ref);
      });

      const applianceRef = collection(db, getCol('applianceStockItems'));
      const applianceSnap = await getDocs(applianceRef);
      applianceSnap.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      
      localStorage.setItem(`seeded_${getCol('stockItems')}`, 'true');
      localStorage.setItem(`seeded_${getCol('applianceStockItems')}`, 'true');
      
      setIsDeleteConfirmModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `allProducts/${getCol('stockItems')}`);
    }
  };

  const handleRestoreDefaultProducts = async () => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      
      const stockRef = collection(db, getCol('stockItems'));
      const stockSnap = await getDocs(stockRef);
      stockSnap.forEach((doc) => {
        batch.delete(doc.ref);
      });

      const applianceRef = collection(db, getCol('applianceStockItems'));
      const applianceSnap = await getDocs(applianceRef);
      applianceSnap.forEach((doc) => {
        batch.delete(doc.ref);
      });

      INITIAL_PRODUCTS.forEach((p) => {
        const productRef = doc(db, getCol('stockItems'), p.id);
        batch.set(productRef, {
          id: p.id,
          name: p.name,
          sellingPrice: p.price,
          costPrice: p.cost,
          costPriceBaht: p.costTHB,
          wholesalePrice: p.wholesalePrice,
          category: p.category,
          currentStock: p.stock,
          image: ''
        });
      });

      await batch.commit();
      localStorage.removeItem(`seeded_${getCol('stockItems')}`);
      localStorage.removeItem(`seeded_${getCol('applianceStockItems')}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'restoreProducts');
    }
  };

  const handleInlineProductUpdate = async (id: string, field: string, value: any) => {
    if (!user) return;
    const targetProduct = products.find(p => p.id === id);
    const colName = targetProduct?.collectionName || 'stockItems';
    try {
      const productRef = doc(db, getCol(colName), id);
      const updateData: any = {};
      
      // Map frontend field names to Firestore field names if necessary
      const fieldMap: Record<string, string> = {
        name: 'name',
        price: 'sellingPrice',
        cost: 'costPrice',
        costTHB: 'costPriceBaht',
        wholesalePrice: 'wholesalePrice',
        category: 'category',
        stock: 'currentStock',
        size: 'size'
      };

      const firestoreField = fieldMap[field] || field;
      let finalValue = value;
      if (field === 'stock') {
        finalValue = Math.max(0, Number(value));
      }
      updateData[firestoreField] = finalValue;
      
      await updateDoc(productRef, updateData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${getCol(colName)}/${id}`);
    }
  };

  // --- POS Logic ---
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const cleanSearch = searchTerm.trim().toLowerCase();
      const matchesSearch = p.name.toLowerCase().includes(cleanSearch);
      
      const pCat = (p.category || '').trim();
      const selCat = (selectedCategory || '').trim();
      const matchesCategory = selectedCategory === 'ທັງໝົດ' || pCat === selCat;
      
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateCartQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, quantity: Math.max(0, item.quantity + delta) };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartTotalCost = cart.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
  const cartTax = 0; // VAT removed as requested
  const cartTotal = Math.max(0, cartSubtotal - discount);

  const handleCheckout = async () => {
    if (cart.length === 0 || !user) return;
    
    const saleId = `SALE-${Date.now()}`;
    const newSale: Sale = {
      id: saleId,
      timestamp: Date.now(),
      items: [...cart],
      subtotal: cartSubtotal,
      tax: cartTax,
      discount: discount,
      total: cartTotal,
      paymentMethod: 'cash' // Defaulting to cash as requested to remove selection
    };

    try {
      const batch = writeBatch(db);
      
      // Save sale
      batch.set(doc(db, getCol('sales'), saleId), newSale);

      // Update stocks
      cart.forEach(item => {
        const originalProduct = products.find(p => p.id === item.id);
        const colName = originalProduct?.collectionName || 'stockItems';
        const productRef = doc(db, getCol(colName), item.id);
        if (originalProduct) {
          batch.update(productRef, {
            currentStock: Math.max(0, originalProduct.stock - item.quantity)
          });
        }
      });

      await batch.commit();
      
      setReceipt(newSale);
      setCart([]);
      setDiscount(0);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${getCol('sales')}/batch`);
    }
  };

  const handleDeleteSale = async (sale: Sale) => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      
      // Restore stocks
      sale.items.forEach(item => {
        const originalProduct = products.find(p => p.id === item.id);
        const colName = originalProduct?.collectionName || 'stockItems';
        const productRef = doc(db, getCol(colName), item.id);
        if (originalProduct) {
          batch.update(productRef, {
            currentStock: originalProduct.stock + item.quantity
          });
        }
      });

      // Delete sale
      batch.delete(doc(db, getCol('sales'), sale.id));

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${getCol('sales')}/${sale.id}`);
    }
  };

  // --- Accounting Logic ---
  const handleAddTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const type = formData.get('type') as 'income' | 'expense';
    const amount = Number(formData.get('amount'));
    const description = formData.get('description') as string;
    const category = formData.get('category') as string;
    const businessType = formData.get('businessType') as string;
    const dateStr = formData.get('date') as string;

    const transactionId = `TX-${Date.now()}`;
    const newTransaction = {
      type,
      amount,
      description,
      category,
      businessType,
      date: new Date(dateStr),
      createdAt: new Date()
    };

    const form = e.currentTarget;

    try {
      await setDoc(doc(db, getCol('agriculture-transactions'), transactionId), newTransaction);
      form.reset();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, getCol('agriculture-transactions'));
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, getCol('agriculture-transactions'), id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${getCol('agriculture-transactions')}/${id}`);
    }
  };

  const handleUpdateTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !editingTransactionId) return;
    const formData = new FormData(e.currentTarget);
    const updates = {
      type: formData.get('type') as 'income' | 'expense',
      amount: Number(formData.get('amount')),
      description: formData.get('description') as string,
      category: formData.get('category') as string,
      businessType: formData.get('businessType') as string,
      date: new Date(formData.get('date') as string),
    };
    try {
      await updateDoc(doc(db, getCol('agriculture-transactions'), editingTransactionId), updates);
      setEditingTransactionId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${getCol('agriculture-transactions')}/${editingTransactionId}`);
    }
  };

  const handleUpdateAccountingConfig = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !editingConfigField) return;
    const formData = new FormData(e.currentTarget);
    const newValue = Number(formData.get('value'));
    
    if (isNaN(newValue)) return;

    await handleUpdateConfig({ [editingConfigField]: newValue });
    setEditingConfigField(null);
  };

  const monthlySummary = useMemo(() => {
    const monthTransactions = transactions.filter(t => {
      return t.date.slice(0, 7) === selectedAccountingMonth && !t.id.startsWith('TX-TR-');
    });

    const incomeFromTransactions = monthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expensesFromTransactions = monthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalMonthlyIncome = incomeFromTransactions;
    const totalMonthlyExpense = expensesFromTransactions;
    const monthlyProfit = totalMonthlyIncome - totalMonthlyExpense;

    // Previous months profit (Brought Forward) - only manual transactions
    const prevTransactions = transactions.filter(t => t.date.slice(0, 7) < selectedAccountingMonth && !t.id.startsWith('TX-TR-'));
    
    const prevIncome = prevTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const prevExpense = prevTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const broughtForward = prevIncome - prevExpense;

    return {
      circulating: accountingConfig.circulatingMoney,
      income: totalMonthlyIncome,
      total: accountingConfig.circulatingMoney + totalMonthlyIncome,
      expense: totalMonthlyExpense,
      balance: (accountingConfig.circulatingMoney + totalMonthlyIncome) - totalMonthlyExpense,
      profit: monthlyProfit,
      broughtForward: broughtForward,
      monthEnd: broughtForward + monthlyProfit
    };
  }, [transactions, selectedAccountingMonth, accountingConfig.circulatingMoney]);

  const handleUpdateCashCalc = async (updates: Partial<Record<string, number>>) => {
    const next = { ...cashCalc, ...updates };
    setCashCalc(next);
    try {
      await setDoc(doc(db, getCol('cashCalculatorState'), 'latest'), { counts: next });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${getCol('cashCalculatorState')}/latest`);
    }
  };

  const handleUpdateConfig = async (updates: Partial<AccountingConfig>) => {
    const next = { ...accountingConfig, ...updates };
    setAccountingConfig(next); // optimistic
    try {
      await setDoc(doc(db, getCol('config'), 'accounting'), next);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${getCol('config')}/accounting`);
    }
  };

  const handleClearTransactions = async () => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      transactions.forEach(tx => {
        if (!tx.id.startsWith('TX-TR-') && tx.date.startsWith(selectedAccountingMonth)) {
          batch.delete(doc(db, getCol('agriculture-transactions'), tx.id));
        }
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${getCol('agriculture-transactions')}-batch`);
    }
  };

  const totalCashCalc = useMemo(() => {
    const kip = (cashCalc['100000'] * 100000) + 
                (cashCalc['50000'] * 50000) + 
                (cashCalc['20000'] * 20000) + 
                (cashCalc['10000'] * 10000) + 
                (cashCalc['5000'] * 5000) + 
                (cashCalc['2000'] * 2000) + 
                (cashCalc['1000'] * 1000);
    const bahtConverted = cashCalc['baht'] * cashCalc['bahtRate'];
    const usdConverted = cashCalc['usd'] * cashCalc['usdRate'];
    return kip + bahtConverted + usdConverted;
  }, [cashCalc]);

  const medicalDebtors = useMemo(() => {
    return medicineEntries
      .filter(item => !item.isPaid)
      .reduce((sum, item) => sum + (item.cost + (item.sellingPrice - item.cost) * 0.4), 0);
  }, [medicineEntries]);

  const generalDebtors = useMemo(() => {
    const keywords = ['ຢາ', 'ຄ່າຍາ', 'ຄ່າຢາ'];
    return debtorEntries
      .filter(e => e.type === 'debtor' && !e.isPaid && !keywords.some(k => e.description.toLowerCase().includes(k.toLowerCase())))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [debtorEntries]);

  const totalDebtors = useMemo(() => {
    return generalDebtors + medicalDebtors;
  }, [generalDebtors, medicalDebtors]);

  const totalCreditors = useMemo(() => {
    return debtorEntries
      .filter(e => e.type === 'creditor' && !e.isPaid)
      .reduce((sum, e) => sum + e.amount, 0);
  }, [debtorEntries]);

  // --- Transport / COD Logic ---
  const filteredTransportEntries = useMemo(() => {
    // Re-using selectedAccountingMonth for transport filtering as well
    const start = startOfMonth(new Date(selectedAccountingMonth)).getTime();
    const end = endOfMonth(new Date(selectedAccountingMonth)).getTime();
    return transportEntries.filter(entry => entry.date >= start && entry.date <= end);
  }, [transportEntries, selectedAccountingMonth]);

  const dailySummaries = useMemo(() => {
    const grouped: Record<string, { 
      date: Date; 
      entries: TransportEntry[];
      profit: number;
      orderCount: number;
      unfinishedCount: number;
      remainingAmount: number;
    }> = {};

    filteredTransportEntries.forEach(entry => {
      const date = new Date(entry.date);
      const dayKey = format(date, 'yyyy-MM-dd');
      if (!grouped[dayKey]) {
        grouped[dayKey] = {
          date: date,
          entries: [],
          profit: 0,
          orderCount: 0,
          unfinishedCount: 0,
          remainingAmount: 0
        };
      }
      grouped[dayKey].entries.push(entry);
      const totalCost = (entry.cost || 0) * (entry.quantity || 1);
      grouped[dayKey].profit += (entry.amount || 0) - totalCost;
      grouped[dayKey].orderCount += 1;
      if (!entry.finished) {
        grouped[dayKey].unfinishedCount += 1;
        grouped[dayKey].remainingAmount += (entry.amount || 0);
      }
    });

    return Object.values(grouped).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [filteredTransportEntries]);

  const transportStats = useMemo(() => {
    const totalAmount = filteredTransportEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalCost = filteredTransportEntries.reduce((sum, e) => sum + ((e.cost || 0) * (e.quantity || 1)), 0);
    const remaining = filteredTransportEntries.filter(e => !e.finished).reduce((sum, e) => sum + (e.amount || 0), 0);
    const profit = totalAmount - totalCost;
    return { totalAmount, totalCost, remaining, profit };
  }, [filteredTransportEntries]);

  const transportRemainingAllMonths = useMemo(() => {
    return transportEntries
      .filter(e => !e.finished)
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [transportEntries]);

  const codChartData = useMemo(() => {
    const monthlyMap: Record<string, { month: string; profit: number; amount: number; cost: number }> = {};
    const yearlyMap: Record<string, { year: string; profit: number; amount: number; cost: number }> = {};

    transportEntries.forEach(entry => {
      if (!entry.date) return;
      const d = new Date(entry.date);
      if (isNaN(d.getTime())) return;
      
      const yearStr = d.getFullYear().toString();
      const monthStr = `${yearStr}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      const amount = entry.amount || 0;
      const cost = (entry.cost || 0) * (entry.quantity || 1);
      const profit = amount - cost;

      if (!monthlyMap[monthStr]) {
        monthlyMap[monthStr] = { month: monthStr, profit: 0, amount: 0, cost: 0 };
      }
      monthlyMap[monthStr].profit += profit;
      monthlyMap[monthStr].amount += amount;
      monthlyMap[monthStr].cost += cost;

      if (!yearlyMap[yearStr]) {
        yearlyMap[yearStr] = { year: yearStr, profit: 0, amount: 0, cost: 0 };
      }
      yearlyMap[yearStr].profit += profit;
      yearlyMap[yearStr].amount += amount;
      yearlyMap[yearStr].cost += cost;
    });

    const monthlyList = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));
    const yearlyList = Object.values(yearlyMap).sort((a, b) => a.year.localeCompare(b.year));

    return {
      monthly: monthlyList,
      yearly: yearlyList
    };
  }, [transportEntries]);

  const handleAddTransportEntry = async (type: 'ANS' | 'HAL' | 'MX' | 'COD') => {
    if (!user) return;
    const entryId = `TR-${Date.now()}`;
    const newEntry: TransportEntry = {
      id: entryId,
      type,
      detail: '',
      cost: 0,
      quantity: 1,
      amount: 0,
      finished: false,
      date: Date.now()
    };
    try {
      await setDoc(doc(db, getCol('transportEntries'), entryId), newEntry);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, getCol('transportEntries'));
    }
  };

  const handleUpdateTransportEntry = async (id: string, updatedFields: Partial<TransportEntry>) => {
    if (!user) return;
    try {
      const entry = transportEntries.find(e => e.id === id);
      if (entry) {
        const mergedEntry = { ...entry, ...updatedFields };
        const txId = `TX-TR-${id}`;

        if (mergedEntry.finished) {
          const amount = mergedEntry.amount || 0;
          const cost = mergedEntry.cost || 0;
          const qty = mergedEntry.quantity || 1;
          const profit = amount - (cost * qty);

          if (profit !== 0) {
            const newTransaction = {
              type: profit > 0 ? 'income' : 'expense',
              amount: Math.abs(profit),
              description: `ກຳໄລຈາກຂົນສົ່ງ ${mergedEntry.type}: ${mergedEntry.detail || ''}`,
              category: 'ຂົນສົ່ງ',
              businessType: 'transport',
              date: new Date(mergedEntry.date),
              createdAt: new Date()
            };
            await setDoc(doc(db, getCol('agriculture-transactions'), txId), newTransaction);
          } else {
            try { await deleteDoc(doc(db, getCol('agriculture-transactions'), txId)); } catch (e) { /* ignore */ }
          }
        } else if (entry.finished && !mergedEntry.finished) {
          try { await deleteDoc(doc(db, getCol('agriculture-transactions'), txId)); } catch (e) { /* ignore */ }
        }
      }
      await updateDoc(doc(db, getCol('transportEntries'), id), updatedFields);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${getCol('transportEntries')}/${id}`);
    }
  };

  const handleDeleteTransportEntry = async (id: string) => {
    if (!user) return;
    try {
      const txId = `TX-TR-${id}`;
      try { await deleteDoc(doc(db, getCol('agriculture-transactions'), txId)); } catch (e) { /* ignore */ }
      await deleteDoc(doc(db, getCol('transportEntries'), id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${getCol('transportEntries')}/${id}`);
    }
  };

  const handleClearCategoryEntries = async (type: string) => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      const entriesToDelete = filteredTransportEntries.filter(e => e.type === type);
      
      for (const entry of entriesToDelete) {
        const txId = `TX-TR-${entry.id}`;
        batch.delete(doc(db, getCol('agriculture-transactions'), txId));
        batch.delete(doc(db, getCol('transportEntries'), entry.id));
      }
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${getCol('transportEntries')}-batch-${type}`);
    }
  };

  const handleAddDebtor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    const id = `DB-${Date.now()}`;
    const dateValue = formData.get('date') as string;
    
    const newEntry = {
      type: formData.get('type') as 'debtor' | 'creditor',
      amount: Number(formData.get('amount')),
      description: formData.get('description') as string,
      date: new Date(dateValue),
      isPaid: false,
      createdAt: new Date()
    };
    try {
      await setDoc(doc(db, getCol('debtorCreditorEntries'), id), newEntry);
      form.reset();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, getCol('debtorCreditorEntries'));
    }
  };

  const [editingDebtorId, setEditingDebtorId] = useState<string | null>(null);

  const handleUpdateDebtor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !editingDebtorId) return;
    const formData = new FormData(e.currentTarget);
    const dateValue = formData.get('date') as string;
    
    const updates = {
      type: formData.get('type') as 'debtor' | 'creditor',
      amount: Number(formData.get('amount')),
      description: formData.get('description') as string,
      date: new Date(dateValue),
    };
    try {
      await updateDoc(doc(db, getCol('debtorCreditorEntries'), editingDebtorId), updates);
      setEditingDebtorId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${getCol('debtorCreditorEntries')}/${editingDebtorId}`);
    }
  };

  const handleUpdateDebtorStatus = async (id: string, isPaid: boolean) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, getCol('debtorCreditorEntries'), id), { isPaid });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${getCol('debtorCreditorEntries')}/${id}`);
    }
  };

  const handleDeleteDebtor = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, getCol('debtorCreditorEntries'), id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${getCol('debtorCreditorEntries')}/${id}`);
    }
  };

  const handleAddMedicineEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const newDocRef = doc(collection(db, getCol('medicineDebtors')));
      await setDoc(newDocRef, {
        id: newDocRef.id,
        orderNo: Number(medFormOrderNo) || 1,
        name: medFormName,
        note: medFormNote,
        cost: Number(medFormCost) || 0,
        sellingPrice: Number(medFormSellingPrice) || 0,
        isPaid: false,
        date: medFormDate,
        month: medFormDate.slice(0, 7),
        createdAt: new Date().toISOString()
      });
      setMedFormName('');
      setMedFormNote('');
      setMedFormCost('0');
      setMedFormSellingPrice('0');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, getCol('medicineDebtors'));
    }
  };

  const handleToggleOrderPaid = async (date: string, orderNo: number, currentlyPaid: boolean) => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      const itemsToUpdate = medicineEntries.filter(e => e.date === date && e.orderNo === orderNo);
      itemsToUpdate.forEach(item => {
        const docRef = doc(db, getCol('medicineDebtors'), item.id);
        batch.update(docRef, { isPaid: !currentlyPaid });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${getCol('medicineDebtors')}-togglePaid-${date}-${orderNo}`);
    }
  };

  const handleDeleteMedicineItem = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, getCol('medicineDebtors'), id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${getCol('medicineDebtors')}/${id}`);
    }
  };

  const handleUpdateMedicineItem = async (id: string, cost: number, sellingPrice: number, name: string, note: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, getCol('medicineDebtors'), id), {
        cost,
        sellingPrice,
        name,
        note
      });
      setEditingMedicineId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${getCol('medicineDebtors')}/${id}`);
    }
  };

  // --- Reports Data ---
  const [reportViewMode, setReportViewMode] = useState<'daily' | 'monthly'>('daily');
  const [selectedReportDay, setSelectedReportDay] = useState<string | null>(null);
  const [reportMonth, setReportMonth] = useState(new Date().getMonth());
  const [reportYear, setReportYear] = useState(new Date().getFullYear());

  const reportData = useMemo(() => {
    if (reportViewMode === 'daily') {
      const daysInMonth = new Date(reportYear, reportMonth + 1, 0).getDate();
      
      return Array.from({ length: daysInMonth }).map((_, i) => {
        const date = new Date(Date.UTC(reportYear, reportMonth, daysInMonth - i));
        const dateStr = date.toISOString().split('T')[0];
        
        const daySales = sales.filter(s => new Date(s.timestamp).toISOString().split('T')[0] === dateStr);
        const revenue = daySales.reduce((s, x) => s + x.total, 0);
        const cost = daySales.reduce((s, x) => {
          const itemCosts = x.items.reduce((sc, item) => sc + (item.cost * item.quantity), 0);
          return s + itemCosts;
        }, 0);
        const profit = revenue - cost;
        
        return {
          date: dateStr,
          revenue,
          cost,
          profit,
          margin: revenue > 0 ? (profit / revenue) * 100 : 0,
          salesCount: daySales.length,
          salesList: daySales
        };
      });
    } else {
      // Monthly View
      const months = ['ມັງກອນ', 'ກຸມພາ', 'ມີນາ', 'ເມສາ', 'ພຶດສະພາ', 'ມິຖຸນາ', 'ກໍລະກົດ', 'ສິງຫາ', 'ກັນຍາ', 'ຕຸລາ', 'ພະຈິກ', 'ທັນວາ'];
      const today = new Date();
      return months.map((month, idx) => {
        const monthSales = sales.filter(s => {
          const d = new Date(s.timestamp);
          return d.getMonth() === idx && d.getFullYear() === today.getFullYear();
        });
        
        const revenue = monthSales.reduce((s, x) => s + x.total, 0);
        const cost = monthSales.reduce((s, x) => {
          const itemCosts = x.items.reduce((sc, item) => sc + (item.cost * item.quantity), 0);
          return s + itemCosts;
        }, 0);
        const profit = revenue - cost;

        return {
          date: month,
          revenue,
          cost,
          profit,
          margin: revenue > 0 ? (profit / revenue) * 100 : 0,
          salesCount: monthSales.length,
          salesList: monthSales
        };
      }).filter((_, i) => i <= today.getMonth()).reverse();
    }
  }, [sales, reportViewMode, reportMonth, reportYear]);

  const kpiStats = useMemo(() => {
    const filteredSales = sales.filter(s => {
      const date = new Date(s.timestamp);
      return date.getMonth() === reportMonth && date.getFullYear() === reportYear;
    });

    const totalRevenue = filteredSales.reduce((s, d) => s + d.total, 0);
    const totalCost = filteredSales.reduce((s, d) => {
      const itemCosts = d.items.reduce((sc, item) => sc + (item.cost * item.quantity), 0);
      return s + itemCosts;
    }, 0);
    const totalProfit = totalRevenue - totalCost;
    const totalBills = filteredSales.length;

    return {
      revenue: totalRevenue,
      cost: totalCost,
      profit: totalProfit,
      bills: totalBills
    };
  }, [sales, reportMonth, reportYear]);

  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach(p => {
      const cat = (p.category || '').trim();
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [products]);

  const categorySummaryData = useMemo(() => {
    const cats = categories.filter(c => c !== 'ທັງໝົດ');
    return cats.map(cat => {
      const catProducts = products.filter(p => (p.category || '').trim() === cat.trim());
      const totalStock = catProducts.reduce((s, p) => s + p.stock, 0);
      const totalValue = catProducts.reduce((s, p) => s + (p.price * p.stock), 0);
      const totalCost = catProducts.reduce((s, p) => s + (p.cost * p.stock), 0);
      return { 
        name: cat, 
        stock: totalStock, 
        value: totalValue,
        cost: totalCost,
        count: catProducts.length 
      };
    }).filter(cat => cat.count > 0);
  }, [products, categories]);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  if (isAuthLoading) {
    return (
      <div className="fixed inset-0 bg-[#0b0b14] flex items-center justify-center z-[200]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <span className="text-xs font-bold text-white/20 uppercase tracking-widest">ກຳລັງໂຫລດ...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0b14] text-white font-sans overflow-hidden flex flex-col">
      {/* Top Navigation Bar */}
      <header className="h-auto md:h-16 px-4 md:px-6 bg-[#0b0b14] border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between z-[60] shrink-0">
        <div className="flex items-center justify-between md:justify-start gap-4 md:gap-10 h-16 md:h-full w-full md:w-auto shrink-0">
          <div className="flex items-center gap-3 md:gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black">⬡</div>
              <span className="text-xl font-black text-white tracking-widest uppercase">POS</span>
            </div>

            {/* Shop Selector */}
            <div className="flex bg-white/5 border border-white/10 p-0.5 rounded-lg select-none shrink-0">
              <button
                type="button"
                onClick={() => handleShopChange('agriculture')}
                className={cn(
                  "px-2.5 py-1 rounded text-[10px] md:text-xs font-bold transition-all flex items-center gap-1",
                  currentShop === 'agriculture'
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                    : "text-white/50 hover:text-white"
                )}
              >
                🌱 <span className="hidden sm:inline">ຮ້ານກະເສດ</span><span className="inline sm:hidden">ກະເສດ</span>
              </button>
              <button
                type="button"
                onClick={() => handleShopChange('sports')}
                className={cn(
                  "px-2.5 py-1 rounded text-[10px] md:text-xs font-bold transition-all flex items-center gap-1",
                  currentShop === 'sports'
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                    : "text-white/50 hover:text-white"
                )}
              >
                ⚽ <span className="hidden sm:inline">ຮ້ານກິລາ</span><span className="inline sm:hidden">ກິລາ</span>
              </button>
            </div>
          </div>

          {/* User profile inside top header on mobile devices only */}
          <div className="flex md:hidden items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2 cursor-pointer" onClick={handleLogout} title="ຄລິກເພື່ອອອກຈາກລະບົບ">
                <span className="text-[10px] font-bold text-white/50">{user.displayName || 'Guest'}</span>
                <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 p-0.5">
                  <img src={user.photoURL || "https://api.dicebear.com/7.x/avataaars/svg?seed=POS"} alt="User" className="w-full h-full rounded-full" />
                </div>
              </div>
            ) : (
              <Button onClick={handleLogin} className="px-4 py-1.5 text-[10px] uppercase font-bold">
                ເຂົ້າສູ່ລະບົບ
              </Button>
            )}
          </div>
        </div>

        {/* Scrollable nav list on mobile and standard row on desktop */}
        <div className="w-full md:w-auto overflow-x-auto scrollbar-none border-t border-white/5 md:border-t-0 -mx-4 px-4 md:-mx-0 md:px-0 shrink-0">
          <nav className="flex h-12 md:h-16 items-center whitespace-nowrap min-w-max md:min-w-0">
            {[
              { id: 'pos', label: 'ຂາຍສິນຄ້າ', icon: ShoppingCart },
              { id: 'inventory', label: 'ສຕັອກ', icon: Package },
              { id: 'reports', label: 'ລາຍງານ', icon: BarChart3 },
              { id: 'accounting', label: 'ບັນຊີ', icon: Wallet },
              { id: 'cod', label: 'ເກັບ COD', icon: Truck },
              { id: 'debtors', label: 'ລູກໜີ້ເຈົ້າໜີ້', icon: Users },
              { id: 'medicine_debtors', label: 'ລູກໜີ້ຄ່າຢາ', icon: Pill },
            ].filter((item) => {
              if (currentShop === 'sports' && (item.id === 'debtors' || item.id === 'medicine_debtors')) {
                return false;
              }
              return true;
            }).map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={cn(
                  "px-4 md:px-6 h-full flex items-center gap-1.5 md:gap-2 text-xs md:text-sm font-bold transition-all relative border-b-2 shrink-0",
                  activeTab === item.id 
                    ? "text-indigo-400 border-indigo-500 bg-white/5" 
                    : "text-white/40 border-transparent hover:text-white"
                )}
              >
                <item.icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Desktop profile/date section (hidden on mobile) */}
        <div className="hidden md:flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-white/20 uppercase">ວັນທີ {new Date().toLocaleDateString('lo-LA')}</span>
          </div>
          {user ? (
            <div className="flex items-center gap-3 group relative cursor-pointer" onClick={handleLogout}>
              <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 p-0.5 group-hover:border-rose-500/50 transition-colors">
                <img src={user.photoURL || "https://api.dicebear.com/7.x/avataaars/svg?seed=POS"} alt="User" className="w-full h-full rounded-full" />
              </div>
              <div className="absolute top-full right-0 mt-2 bg-[#161623] border border-white/10 rounded-xl px-4 py-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-2xl z-[100]">
                <span className="text-xs text-rose-400 font-bold uppercase tracking-widest">ອອກຈາກລະບົບ</span>
              </div>
            </div>
          ) : (
            <Button onClick={handleLogin} className="px-6 py-2 text-xs uppercase font-bold">
              ເຂົ້າສູ່ລະບົບ
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        {false ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-24 h-24 bg-indigo-600/10 rounded-3xl flex items-center justify-center mb-8 text-indigo-500 animate-pulse">
              <LogOut className="w-12 h-12 rotate-180" />
            </div>
            <h2 className="text-3xl font-black mb-4 uppercase tracking-tighter">ກະລຸນາເຂົ້າສູ່ລະບົບ</h2>
            <p className="text-white/40 max-w-xs mb-8 font-medium">ທ່ານຕ້ອງເຂົ້າສູ່ລະບົບເພື່ອຈັດການສາງສິນຄ້າ ແລະ ເບິ່ງລາຍງານການຂາຍ</p>
            <Button onClick={handleLogin} className="px-12 py-4 text-lg font-bold">
              ເຂົ້າສູ່ລະບົບດ້ວຍ Google
            </Button>
          </div>
        ) : (
          <>
            {/* Search & Header for Views */}
        {activeTab !== 'reports' && (
          <header className="h-14 border-b border-white/5 flex items-center justify-between px-8 bg-[#0b0b14]/50 backdrop-blur-md z-40 shrink-0">
            <div>
              {activeTab === 'pos' ? (
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20 group-focus-within:text-indigo-400 transition-colors" />
                  <input 
                    type="text" 
                    placeholder="ຄົ້ນຫາຊື່ສິນຄ້າ..." 
                    className="bg-white/5 border border-white/10 rounded-lg px-9 py-1.5 text-xs focus:outline-none focus:border-indigo-500/50 w-64 transition-all text-white placeholder-white/20 font-bold"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ) : (
                <h1 className="text-base font-bold flex items-center gap-2 uppercase tracking-widest text-white/50">
                  {activeTab === 'inventory' && (
                    <>
                      <Package className="w-4 h-4" />
                      ຈັດການສາງສິນຄ້າ
                    </>
                  )}
                  {activeTab === 'accounting' && (
                    <>
                      <Wallet className="w-4 h-4" />
                      ຈັດການບັນຊີ
                    </>
                  )}
                  {activeTab === 'cod' && (
                    <>
                      <Truck className="w-4 h-4" />
                      ເກັບ COD / ຂົນສົ່ງ
                    </>
                  )}
                  {activeTab === 'medicine_debtors' && (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          setActiveTab('debtors');
                          setDebtorsSubTab('general');
                        }}
                        className="mr-1 p-1 hover:bg-white/5 rounded-lg transition-colors text-white/60 hover:text-white"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <span className="flex items-center gap-2 text-white">
                        <Pill className="w-4 h-4 text-emerald-400" />
                        ລູກໜີ້ຄ່າຢາ
                      </span>
                    </div>
                  )}
                  {activeTab === 'debtors' && (
                    debtorsSubTab === 'medicine' ? (
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setDebtorsSubTab('general')}
                          className="mr-1 p-1 hover:bg-white/5 rounded-lg transition-colors text-white/60 hover:text-white"
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <span className="flex items-center gap-2 text-white">
                          <Users className="w-4 h-4 text-rose-400" />
                          ລູກໜີ້ຄ່າຢາ
                        </span>
                      </div>
                    ) : (
                      <>
                        <Users className="w-4 h-4" />
                        ຈັດການລູກໜີ້ - ເຈົ້າໜີ້
                      </>
                    )
                  )}
                </h1>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* Other header items if needed, empty if none */}
            </div>
          </header>
        )}

            {/* Dynamic View */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {activeTab === 'pos' && (
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 h-full p-4 lg:p-8 overflow-hidden">
              {/* POS Mobile Tab Selectors */}
              <div className="flex lg:hidden bg-[#161623] p-1 rounded-xl border border-white/5 shrink-0 gap-1 select-none">
                <button
                  type="button"
                  onClick={() => setMobilePosActiveTab('products')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all",
                    mobilePosActiveTab === 'products' ? "bg-indigo-600 text-white shadow-lg" : "text-white/40"
                  )}
                >
                  📦 ໝວດສິນຄ້າ ({filteredProducts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMobilePosActiveTab('cart')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all relative",
                    mobilePosActiveTab === 'cart' ? "bg-indigo-600 text-white shadow-lg" : "text-white/40"
                  )}
                >
                  🛒 ກະຕ່າ ({cart.reduce((sum, item) => sum + item.quantity, 0)})
                </button>
              </div>

              {/* Product Grid Area */}
              <div className={cn(
                "flex-1 flex flex-col min-w-0 h-full overflow-hidden",
                mobilePosActiveTab === 'products' ? "flex" : "hidden lg:flex"
              )}>
                {/* Categories */}
                <div className="flex gap-3 overflow-x-auto pb-4 shrink-0 px-1">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={cn(
                        "px-6 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border",
                        selectedCategory === cat 
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20" 
                          : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Product Grid Scrolling Area */}
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-10 mt-6">
                  <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-2">
                  {filteredProducts.map(product => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      key={product.id}
                      onClick={() => addToCart(product)}
                      className={cn(
                        "group p-2 bg-[#161623]/60 border border-white/5 rounded-xl cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all relative overflow-hidden flex flex-col h-full",
                        product.stock <= 0 && "opacity-60"
                      )}
                    >
                      {product.image ? (
                        <div className="w-full h-20 mb-2 rounded-lg overflow-hidden bg-black/40">
                          <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        </div>
                      ) : (
                        <div className="w-full h-20 mb-2 rounded-lg bg-white/5 flex items-center justify-center text-white/10 group-hover:bg-white/10 transition-colors">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                      )}
                      <div className="mb-1 text-[9px] font-bold text-indigo-400 uppercase tracking-wider">{product.category}</div>
                      <h3 className="font-bold text-[11px] mb-1 group-hover:text-indigo-200 transition-colors line-clamp-2 flex-1">{product.name}</h3>
                      {product.size && (
                        <div className="text-[9px] text-white/40 mb-1">ໄຊ້: {product.size}</div>
                      )}
                      <div className="flex items-center justify-between mt-auto pt-2">
                        <div className="text-xs font-black text-indigo-400">{product.price.toLocaleString()}</div>
                        <div className={cn(
                          "px-1.5 py-0.5 rounded text-[8px] font-bold",
                          product.stock < 10 ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"
                        )}>
                          {product.stock}
                        </div>
                      </div>

                      {/* Hover Indicator */}
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-indigo-600 p-1 rounded-lg">
                          <Plus className="w-3 h-3 text-white" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

              {/* Cart / Order Panel */}
              <aside className={cn(
                "w-full lg:w-96 flex flex-col h-full shrink-0 overflow-hidden",
                mobilePosActiveTab === 'cart' ? "flex" : "hidden lg:flex"
              )}>
                <Card className="flex-1 flex flex-col p-0 overflow-hidden border-indigo-500/10 shadow-2xl shadow-black/50">
                  <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5 text-indigo-400" />
                      ລາຍການສັ່ງຊື້
                    </h2>
                    <Button variant="danger" size="sm" onClick={() => setCart([])} className="px-2 py-1 text-[10px] uppercase">
                      ລ້າງທັງໝົດ
                    </Button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    <AnimatePresence mode="popLayout">
                      {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-30">
                          <ShoppingCart className="w-12 h-12 mb-4" />
                          <p className="text-sm font-medium">ບໍ່ມີລາຍການສິນຄ້າ</p>
                        </div>
                      ) : (
                        cart.map((item) => (
                          <motion.div
                            layout
                            key={item.id}
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -20, opacity: 0 }}
                            className="bg-white/5 p-3 rounded-xl border border-white/5"
                          >
                            <div className="flex justify-between mb-2">
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-sm font-semibold truncate pr-2">{item.name}</span>
                                {item.size && (
                                  <span className="text-[10px] text-white/30">ໄຊ້: {item.size}</span>
                                )}
                              </div>
                              <span className="text-sm font-bold text-indigo-400">{(item.price * item.quantity).toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-white/40">{item.price.toLocaleString()} ກີບ</span>
                              <div className="flex items-center gap-3">
                                <button 
                                  onClick={() => updateCartQuantity(item.id, -1)}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-sm font-bold min-w-[20px] text-center">{item.quantity}</span>
                                <button 
                                  onClick={() => updateCartQuantity(item.id, 1)}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Summary */}
                  <div className="p-6 bg-white/[0.02] border-t border-white/5 space-y-3">
                    <div className="flex justify-between text-sm text-white/40">
                      <span>ລວມຍ່ອຍ</span>
                      <span>{cartSubtotal.toLocaleString()} ກີບ</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-white/40">
                      <span>ສ່ວນຫຼຸດ</span>
                      <div className="relative">
                        <input 
                          type="number"
                          value={discount || ''}
                          onChange={(e) => setDiscount(Number(e.target.value))}
                          placeholder="0"
                          className="w-24 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-right text-sm focus:outline-none focus:border-indigo-500/50"
                        />
                      </div>
                    </div>
                    <div className="flex justify-between text-xl font-black pt-2 border-t border-white/5">
                      <span>ລວມທັງໝົດ</span>
                      <span className="text-indigo-400">{cartTotal.toLocaleString()} ກີບ</span>
                    </div>

                    <Button 
                      disabled={cart.length === 0}
                      className="w-full py-4 mt-4 text-lg font-bold"
                      onClick={handleCheckout}
                    >
                      ຊຳລະເງິນ
                    </Button>
                  </div>
                </Card>
              </aside>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
              <div className="space-y-6">
                
                {/* Category Summary Header */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                  <div 
                    onClick={() => setInventoryFilterCategory(null)}
                    className="cursor-pointer"
                  >
                    <Card className={cn(
                      "p-3 transition-all border",
                      !inventoryFilterCategory 
                        ? (currentShop === 'sports' ? "bg-blue-600/20 border-blue-500/50 shadow-lg shadow-blue-500/10" : "bg-emerald-600/20 border-emerald-500/50 shadow-lg shadow-emerald-500/10") 
                        : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05]"
                    )}>
                      <div className="text-[10px] font-bold text-white/30 uppercase mb-1 truncate">ທັງໝົດ</div>
                      <div className={cn(
                        "text-xs font-black truncate",
                        !inventoryFilterCategory
                          ? (currentShop === 'sports' ? "text-blue-400" : "text-emerald-400")
                          : "text-white/80"
                      )}>{products.length} ລາຍການ</div>
                      <div className="text-[9px] text-white/20">ສິນຄ້າທັງໝົດ</div>
                    </Card>
                  </div>
                  {categorySummaryData.map((cat, idx) => (
                    <div 
                      key={cat.name} 
                      onClick={() => setInventoryFilterCategory(cat.name)}
                      className="cursor-pointer"
                    >
                      <Card className={cn(
                        "p-3 transition-all border",
                        inventoryFilterCategory === cat.name 
                          ? (currentShop === 'sports' ? "bg-blue-600/20 border-blue-500/50 shadow-lg shadow-blue-500/10" : "bg-emerald-600/20 border-emerald-500/50 shadow-lg shadow-emerald-500/10") 
                          : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05]"
                      )}>
                        <div className="text-[10px] font-bold text-white/30 uppercase mb-1 truncate">{cat.name}</div>
                        <div className={cn(
                          "text-xs font-black truncate",
                          inventoryFilterCategory === cat.name
                            ? (currentShop === 'sports' ? "text-blue-400" : "text-emerald-400")
                            : "text-white/80"
                        )}>{cat.cost.toLocaleString()} ₭</div>
                        <div className="text-[9px] text-white/20">{cat.count} ລາຍການ</div>
                      </Card>
                    </div>
                  ))}
                </div>

                {/* Search and Statistics Panel */}
                <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between mb-4 w-full">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 flex-1 w-full">
                    {/* Search and View Mode Selectors inside a row */}
                    <div className="flex gap-2 w-full col-span-1 md:col-span-2 xl:col-span-1">
                      <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                        <input
                          type="text"
                          placeholder="ຄົ້ນຫາຊື່ສິນຄ້າ..."
                          value={inventorySearchTerm}
                          onChange={(e) => setInventorySearchTerm(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 transition-all"
                        />
                        {inventorySearchTerm && (
                          <button 
                            onClick={() => setInventorySearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      
                      {/* View Toggle */}
                      <div className="flex bg-white/5 border border-white/10 p-0.5 rounded-xl select-none shrink-0">
                        <button
                          onClick={() => setInventoryViewMode('grid')}
                          className={cn(
                            "p-2 rounded-lg transition-all flex items-center justify-center",
                            inventoryViewMode === 'grid' 
                              ? (currentShop === 'sports' ? "bg-blue-600 text-white" : "bg-emerald-600 text-white") 
                              : "text-white/60 hover:text-white"
                          )}
                          title="ສະແດງແບບກຣິດ (Grid View)"
                        >
                          <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setInventoryViewMode('list')}
                          className={cn(
                            "p-2 rounded-lg transition-all flex items-center justify-center",
                            inventoryViewMode === 'list' 
                              ? (currentShop === 'sports' ? "bg-blue-600 text-white" : "bg-emerald-600 text-white") 
                              : "text-white/60 hover:text-white"
                          )}
                          title="ສະແດງແບບຕາຕະລາງ (List View)"
                        >
                          <List className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {currentShop === 'sports' ? (
                      <>
                        <Card className="py-2 px-4 flex items-center gap-3 bg-blue-500/10 border-blue-500/20">
                          <div className="p-1.5 bg-blue-500/20 rounded-lg text-blue-400">
                            <TrendingUp className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[10px] text-white/40 font-bold uppercase truncate">ມູນຄ່າຕົ້ນທຶນລວມ</div>
                            <div className="text-sm font-black text-blue-400 truncate">
                              {products.reduce((s, p) => s + (p.cost * p.stock), 0).toLocaleString()} ₭
                            </div>
                          </div>
                        </Card>
                        <Card className="py-2 px-4 flex items-center gap-3 bg-indigo-500/10 border-indigo-500/20">
                          <div className="p-1.5 bg-indigo-500/20 rounded-lg text-indigo-400">
                            <TrendingUp className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[10px] text-white/40 font-bold uppercase truncate">ມູນຄ່າລາຄາຂາຍລວມ</div>
                            <div className="text-sm font-black text-indigo-400 truncate">
                              {products.reduce((s, p) => s + (p.price * p.stock), 0).toLocaleString()} ₭
                            </div>
                          </div>
                        </Card>
                      </>
                    ) : (
                      <>
                        <Card className="py-2 px-4 flex items-center gap-3 bg-emerald-500/10 border-emerald-500/20">
                          <div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-400">
                            <TrendingUp className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[10px] text-white/40 font-bold uppercase truncate">ມູນຄ່າສາງ ກະເສດ</div>
                            <div className="text-sm font-black text-emerald-400 truncate">
                              {products.filter(p => !p.collectionName || p.collectionName === 'stockItems').reduce((s, p) => s + (p.cost * p.stock), 0).toLocaleString()} ₭
                            </div>
                          </div>
                        </Card>
                        <Card className="py-2 px-4 flex items-center gap-3 bg-indigo-500/10 border-indigo-500/20">
                          <div className="p-1.5 bg-indigo-500/20 rounded-lg text-indigo-400">
                            <TrendingUp className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[10px] text-white/40 font-bold uppercase truncate">ມູນຄ່າສາງ ເຄື່ອງຄົວ</div>
                            <div className="text-sm font-black text-indigo-400 truncate">
                              {products.filter(p => p.collectionName === 'applianceStockItems').reduce((s, p) => s + (p.cost * p.stock), 0).toLocaleString()} ₭
                            </div>
                          </div>
                        </Card>
                      </>
                    )}

                    <Card className="py-2 px-4 flex items-center gap-3 bg-orange-500/10 border-orange-500/20">
                      <div className="p-1.5 bg-orange-500/20 rounded-lg text-orange-400">
                        <AlertCircle className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] text-white/40 font-bold uppercase truncate">{"ໃກ້ໝົດສາງ (< 10)"}</div>
                        <div className="text-sm font-black text-orange-400 truncate">
                          {products.filter(p => p.stock < 10).length} ລາຍການ
                        </div>
                      </div>
                    </Card>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full lg:w-auto">
                    {products.length > 0 && (
                      <Button 
                        variant="danger"
                        onClick={() => setIsDeleteConfirmModalOpen(true)}
                        className="flex items-center justify-center gap-2 text-xs py-2.5 flex-1 sm:flex-none font-bold"
                      >
                        <Trash2 className="w-4 h-4 text-rose-500" />
                        ລຶບຂໍ້ມູນສາງທັງໝົດ
                      </Button>
                    )}
                    {products.length === 0 && (
                      <Button 
                        variant="secondary"
                        onClick={handleRestoreDefaultProducts}
                        className="flex items-center justify-center gap-2 text-xs py-2.5 flex-1 sm:flex-none font-bold border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/10"
                      >
                        <RefreshCcw className="w-4 h-4" />
                        ຄືນຄ່າຂໍ້ມູນຕົວຢ່າງ
                      </Button>
                    )}
                    <Button 
                      onClick={() => handleOpenProductModal()}
                      className={cn(
                        "flex items-center justify-center gap-2 text-xs py-2.5 flex-1 sm:flex-none font-bold text-white",
                        currentShop === 'sports' ? "bg-blue-600 hover:bg-blue-500" : "bg-indigo-600 hover:bg-indigo-500"
                      )}
                    >
                      <Plus className="w-4 h-4" />
                      ເພີ່ມສິນຄ້າໃໝ່
                    </Button>
                  </div>
                </div>

                {/* View Switcher content */}
                {inventoryViewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {(() => {
                      const filtered = products.filter(p => {
                        const pCat = (p.category || '').trim();
                        const filterCat = (inventoryFilterCategory || '').trim();
                        const matchesCategory = !inventoryFilterCategory || pCat === filterCat;
                        const matchesSearch = p.name.toLowerCase().includes(inventorySearchTerm.trim().toLowerCase());
                        return matchesCategory && matchesSearch;
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="col-span-full py-16 text-center text-white/30 font-bold uppercase tracking-widest text-xs">
                            ບໍ່ພົບຂໍ້ມູນສິນຄ້າ
                          </div>
                        );
                      }

                      return filtered.map(product => {
                        const profit = product.price - product.cost;
                        const margin = product.cost > 0 ? Math.round((profit / product.cost) * 100) : 0;
                        
                        let stockColor = "text-emerald-400";
                        let stockBarColor = "bg-emerald-500";
                        if (product.stock === 0) {
                          stockColor = "text-rose-500 font-black";
                          stockBarColor = "bg-rose-500";
                        } else if (product.stock < 10) {
                          stockColor = "text-orange-400";
                          stockBarColor = "bg-orange-500";
                        }

                        return (
                          <div 
                            key={product.id} 
                            className={cn(
                              "group bg-[#1e1e2e]/40 border rounded-2xl overflow-hidden transition-all flex flex-col justify-between",
                              currentShop === 'sports' 
                                ? "hover:border-blue-500/40 hover:shadow-xl hover:shadow-blue-500/5 border-white/5" 
                                : "hover:border-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/5 border-white/5"
                            )}
                          >
                            <div className="relative h-44 bg-white/[0.02] overflow-hidden shrink-0 flex items-center justify-center">
                              {product.image ? (
                                <img 
                                  src={product.image} 
                                  alt={product.name} 
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-white/10 group-hover:scale-105 transition-transform duration-300">
                                  <ImageIcon className="w-10 h-10 text-white/20" />
                                </div>
                              )}
                              
                              <div className="absolute top-3 left-3">
                                <span className={cn(
                                  "backdrop-blur text-[9px] font-black uppercase text-white px-2 py-0.5 rounded-lg border",
                                  currentShop === 'sports' ? "bg-blue-600/90 border-blue-500/30" : "bg-emerald-600/90 border-emerald-500/30"
                                )}>
                                  {product.category || 'ອື່ນໆ'}
                                </span>
                              </div>

                              <div className="absolute top-3 right-3">
                                <span className={cn(
                                  "backdrop-blur text-[9px] font-black px-2 py-0.5 rounded-lg border",
                                  product.stock === 0 ? "bg-rose-600/90 text-white border-rose-500/30" :
                                  product.stock < 10 ? "bg-orange-600/90 text-white border-orange-500/30" :
                                  "bg-emerald-600/90 text-white border-emerald-500/30"
                                )}>
                                  {product.stock === 0 ? "ໝົດສາງ" : `${product.stock} ໃນສາງ`}
                                </span>
                              </div>
                            </div>

                            <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                              <div className="space-y-2">
                                <h3 className="font-bold text-sm text-white group-hover:text-indigo-400 transition-colors line-clamp-2 min-h-[2.5rem]">
                                  {product.name}
                                </h3>

                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-[10px] text-white/40 font-bold">
                                    <span>ລະດັບສິນຄ້າໃນສາງ</span>
                                    <span className={stockColor}>{product.stock} ລາຍການ</span>
                                  </div>
                                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <div 
                                      className={cn("h-full rounded-full transition-all", stockBarColor)} 
                                      style={{ width: `${Math.min(100, (product.stock / 50) * 100)}%` }} 
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-3 pt-2 border-t border-white/5">
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="bg-white/[0.01] border border-white/5 rounded-xl p-2 text-center">
                                    <div className="text-[8px] text-white/30 font-bold uppercase">ຕົ້ນທຶນ (₭)</div>
                                    <div className="font-bold text-white/80 truncate text-xs">{product.cost.toLocaleString()}</div>
                                  </div>
                                  <div className="bg-white/[0.01] border border-white/5 rounded-xl p-2 text-center">
                                    <div className="text-[8px] text-white/30 font-bold uppercase">ລາຄາຂາຍ (₭)</div>
                                    <div className={cn("font-black truncate text-xs", currentShop === 'sports' ? "text-blue-400" : "text-emerald-400")}>{product.price.toLocaleString()}</div>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between text-[10px] font-bold text-white/40 px-1">
                                  {currentShop === 'sports' ? (
                                    <span>ໄຊ້: <span className="text-white/70">{product.size || 'ບໍ່ມີ'}</span></span>
                                  ) : (
                                    <span>ຂາຍສົ່ງ: <span className="text-white/70">{product.wholesalePrice.toLocaleString()} ₭</span></span>
                                  )}
                                  {margin > 0 && (
                                    <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 text-[9px]">
                                      ກຳໄລ +{margin}%
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 pt-1">
                                  <div className="flex items-center bg-white/5 border border-white/10 rounded-xl overflow-hidden flex-1 h-9">
                                    <button 
                                      onClick={() => handleInlineProductUpdate(product.id, 'stock', Math.max(0, product.stock - 1))}
                                      className="px-2 h-full hover:bg-white/5 transition-colors text-white/60 hover:text-white flex items-center justify-center"
                                      title="ຫຼຸດລົງ 1"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                    <span className="flex-1 text-center font-bold text-xs">{product.stock}</span>
                                    <button 
                                      onClick={() => handleInlineProductUpdate(product.id, 'stock', product.stock + 1)}
                                      className="px-2 h-full hover:bg-white/5 transition-colors text-white/60 hover:text-white flex items-center justify-center"
                                      title="ເພີ່ມຂຶ້ນ 1"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>

                                  <button 
                                    onClick={() => handleOpenProductModal(product)}
                                    className="w-9 h-9 flex items-center justify-center bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 hover:bg-indigo-500/20 hover:text-white transition-all shrink-0"
                                    title="ແກ້ໄຂສິນຄ້າ"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteProduct(product.id)}
                                    className="w-9 h-9 flex items-center justify-center bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 hover:bg-rose-500/20 hover:text-white transition-all shrink-0"
                                    title="ລຶບສິນຄ້າ"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <Card className="p-0 overflow-hidden border-white/5">
                    <div className="overflow-x-auto w-full">
                      <table className="w-full text-left min-w-[1000px]">
                        <thead className="bg-white/5 text-xs font-bold uppercase tracking-wider text-white/40 border-b border-white/5">
                          <tr>
                            <th className="px-6 py-4">ສິນຄ້າ</th>
                            <th className="px-6 py-4">ໝວດໝູ່</th>
                            <th className="px-6 py-4 text-right">ຕົ້ນທຶນ (₭)</th>
                            {currentShop !== 'sports' && <th className="px-6 py-4 text-right">ຕົ້ນທຶນ (฿)</th>}
                            {currentShop === 'sports' && <th className="px-6 py-4 text-center">ຂະໜາດໄຊ້</th>}
                            <th className="px-6 py-4 text-right">ລາຄາຂາຍ</th>
                            {currentShop !== 'sports' && <th className="px-6 py-4 text-right">ຂາຍສົ່ງ</th>}
                            <th className="px-6 py-4 text-center">ໃນສາງ</th>
                            <th className="px-6 py-4 text-right">ລວມມູນຄ່າ</th>
                            <th className="px-6 py-4 text-right">ຈັດການ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {(() => {
                            const filtered = products.filter(p => {
                              const pCat = (p.category || '').trim();
                              const filterCat = (inventoryFilterCategory || '').trim();
                              const matchesCategory = !inventoryFilterCategory || pCat === filterCat;
                              const matchesSearch = p.name.toLowerCase().includes(inventorySearchTerm.trim().toLowerCase());
                              return matchesCategory && matchesSearch;
                            });

                            return filtered.map(product => (
                              <tr key={product.id} className="hover:bg-white/[0.02] transition-colors group">
                                <td className="px-6 py-4 min-w-[280px]">
                                  <div className="flex items-center gap-3 w-full">
                                    <div 
                                      onClick={() => handleOpenProductModal(product)}
                                      className="w-10 h-10 rounded-lg bg-white/5 overflow-hidden flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-indigo-500/50 transition-all"
                                      title="ຄລິກເພື່ອແກ້ໄຂຮູບ ຫຼື ຂໍ້ມູນສິນຄ້າ"
                                    >
                                      {product.image ? (
                                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-white/10">
                                          <ImageIcon className="w-4 h-4" />
                                        </div>
                                      )}
                                    </div>
                                    <input
                                      type="text"
                                      defaultValue={product.name}
                                      onBlur={(e) => {
                                        if (e.target.value !== product.name) {
                                          handleInlineProductUpdate(product.id, 'name', e.target.value);
                                        }
                                      }}
                                      className="bg-transparent border-none focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 font-bold w-full min-w-0 text-white outline-none"
                                    />
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <select
                                    value={product.category}
                                    onChange={(e) => handleInlineProductUpdate(product.id, 'category', e.target.value)}
                                    className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs font-bold uppercase text-white/70 focus:outline-none focus:border-indigo-500/50"
                                  >
                                    {categories.filter(c => c !== 'ທັງໝົດ').map(cat => (
                                      <option key={cat} value={cat} className="bg-[#161623] text-white">{cat}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <input
                                    type="number"
                                    defaultValue={product.cost}
                                    onBlur={(e) => {
                                      const val = Number(e.target.value);
                                      if (val !== product.cost) {
                                        handleInlineProductUpdate(product.id, 'cost', val);
                                      }
                                    }}
                                    className="bg-transparent border-none focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 text-sm text-right w-24"
                                  />
                                </td>
                                {currentShop !== 'sports' && (
                                  <td className="px-6 py-4 text-right">
                                    <input
                                      type="number"
                                      defaultValue={product.costTHB}
                                      onBlur={(e) => {
                                        const val = Number(e.target.value);
                                        if (val !== product.costTHB) {
                                          handleInlineProductUpdate(product.id, 'costTHB', val);
                                        }
                                      }}
                                      className="bg-transparent border-none focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 text-sm text-right text-white/60 w-24"
                                    />
                                  </td>
                                )}
                                {currentShop === 'sports' && (
                                  <td className="px-6 py-4 text-center">
                                    <input
                                      type="text"
                                      defaultValue={product.size || ''}
                                      onBlur={(e) => {
                                        if (e.target.value !== (product.size || '')) {
                                          handleInlineProductUpdate(product.id, 'size', e.target.value);
                                        }
                                      }}
                                      className="bg-transparent border-none focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 text-xs text-center font-bold text-white/70 w-20 outline-none"
                                      placeholder="-"
                                    />
                                  </td>
                                )}
                                <td className="px-6 py-4 text-right">
                                  <input
                                    type="number"
                                    defaultValue={product.price}
                                    onBlur={(e) => {
                                      const val = Number(e.target.value);
                                      if (val !== product.price) {
                                        handleInlineProductUpdate(product.id, 'price', val);
                                      }
                                    }}
                                    className="bg-transparent border-none focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 text-sm text-right font-bold text-indigo-400 w-24"
                                  />
                                </td>
                                {currentShop !== 'sports' && (
                                  <td className="px-6 py-4 text-right">
                                    <input
                                      type="number"
                                      defaultValue={product.wholesalePrice}
                                      onBlur={(e) => {
                                        const val = Number(e.target.value);
                                        if (val !== product.wholesalePrice) {
                                          handleInlineProductUpdate(product.id, 'wholesalePrice', val);
                                        }
                                      }}
                                      className="bg-transparent border-none focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 text-sm text-right text-emerald-400 font-bold w-24"
                                    />
                                  </td>
                                )}
                                <td className="px-6 py-4 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    defaultValue={product.stock}
                                    onBlur={(e) => {
                                      const val = Math.max(0, Number(e.target.value));
                                      if (val !== product.stock) {
                                        handleInlineProductUpdate(product.id, 'stock', val);
                                      }
                                    }}
                                    className={cn(
                                      "bg-transparent border-none focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 text-[10px] font-bold text-center w-16",
                                      product.stock < 10 ? "text-rose-400" : "text-emerald-400"
                                    )}
                                  />
                                </td>
                                <td className="px-6 py-4 text-right text-sm font-black text-white/60">
                                  {(product.stock * product.cost).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button 
                                      variant="outline" 
                                      className="p-1 px-2 text-[10px] uppercase font-bold flex items-center gap-1 bg-white/5 border-white/10 text-white hover:bg-white/10"
                                      onClick={() => handleOpenProductModal(product)}
                                    >
                                      <Edit className="w-3 h-3" />
                                      ແກ້ໄຂ
                                    </Button>
                                    <Button 
                                      variant="danger" 
                                      className="p-1 px-2 text-[10px] uppercase font-bold flex items-center gap-1"
                                      onClick={() => handleDeleteProduct(product.id)}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      ລົບ
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          )}
          
          {activeTab === 'reports' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
              <div className="space-y-8 pb-10">
              {/* Report Header */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">📊</div>
                  <h2 className="text-2xl font-black uppercase tracking-tight">ລາຍງານສະຫຼຸບ</h2>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  {reportViewMode === 'daily' && (
                    <div className="flex bg-[#161623] p-1 rounded-xl border border-white/5 gap-1">
                      <select 
                        value={reportMonth} 
                        onChange={(e) => setReportMonth(Number(e.target.value))}
                        className="bg-transparent text-xs font-bold text-white px-3 py-1 focus:outline-none"
                      >
                        {['ມັງກອນ', 'ກຸມພາ', 'ມີນາ', 'ເມສາ', 'ພຶດສະພາ', 'ມິຖຸນາ', 'ກໍລະກົດ', 'ສິງຫາ', 'ກັນຍາ', 'ຕຸລາ', 'ພະຈິກ', 'ທັນວາ'].map((m, i) => (
                          <option key={m} value={i} className="bg-[#161623] text-white">{m}</option>
                        ))}
                      </select>
                      <select 
                        value={reportYear} 
                        onChange={(e) => setReportYear(Number(e.target.value))}
                        className="bg-transparent text-xs font-bold text-white px-3 py-1 focus:outline-none border-l border-white/5"
                      >
                        {[2024, 2025, 2026].map(y => (
                          <option key={y} value={y} className="bg-[#161623] text-white">{y}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex bg-[#161623] p-1 rounded-xl border border-white/5">
                    <button 
                      onClick={() => setReportViewMode('daily')}
                      className={cn(
                        "flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-bold transition-all",
                        reportViewMode === 'daily' ? "bg-indigo-600 text-white shadow-lg" : "text-white/40 hover:text-white"
                      )}
                    >
                      📅 ລາຍວັນ
                    </button>
                    <button 
                      onClick={() => setReportViewMode('monthly')}
                      className={cn(
                        "flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-bold transition-all",
                        reportViewMode === 'monthly' ? "bg-indigo-600 text-white shadow-lg" : "text-white/40 hover:text-white"
                      )}
                    >
                      🗓️ ລາຍເດືອນ
                    </button>
                  </div>
                </div>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'ລາຍໄດ້ລວມ', value: kpiStats.revenue, icon: '💰', color: 'text-indigo-400', emoji: '💰' },
                  { label: 'ຕົ້ນທຶນລວມ', value: kpiStats.cost, icon: '📦', color: 'text-amber-400', emoji: '📦' },
                  { label: 'ກຳໄລສຸດທິ', value: kpiStats.profit, icon: '📈', color: 'text-emerald-400', emoji: '📈' },
                  { label: 'ຈຳນວນບິນ', value: kpiStats.bills, icon: '🧾', color: 'text-rose-400', emoji: '🧾', unit: ' ບິນ' },
                ].map((stat, i) => (
                  <Card key={i} className="bg-[#1c1c2e] border-white/5 p-8 relative overflow-hidden group">
                    <div className="absolute top-4 right-4 text-3xl opacity-20 group-hover:opacity-40 group-hover:scale-110 transition-all">{stat.emoji}</div>
                    <div className="text-xs font-bold text-white/30 mb-3 uppercase tracking-widest">{stat.label}</div>
                    <div className={stat.color}>
                      <span className="text-4xl font-black leading-none tracking-tighter">
                        {!stat.unit && <span className="text-xl mr-1">₭</span>}
                        {stat.value.toLocaleString()}
                        {stat.unit}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Detailed Sales Table */}
              <Card className="bg-[#1c1c2e] border-white/5 p-0 overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-lg">📅</div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-white/60">
                      ຍອດຂາຍ + ກຳໄລ {reportViewMode === 'daily' ? `ລາຍວັນ ປະຈຳເດືອນ ${['ມັງກອນ', 'ກຸມພາ', 'ມີນາ', 'ເມສາ', 'ພຶດສະພາ', 'ມິຖຸນາ', 'ກໍລະກົດ', 'ສິງຫາ', 'ກັນຍາ', 'ຕຸລາ', 'ພະຈິກ', 'ທັນວາ'][reportMonth]} ${reportYear}` : 'ລາຍເດືອນ'}
                    </h3>
                  </div>
                  {reportViewMode === 'daily' && (
                    <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest italic">ຄລິກທີ່ແຖວເພື່ອເບິ່ງລາຍລະອຽດບິນ</span>
                  )}
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[900px]">
                    <thead className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 border-b border-white/5">
                      <tr>
                        <th className="px-8 py-5">{reportViewMode === 'daily' ? 'ວັນທີ' : 'ເດືອນ'}</th>
                        <th className="px-8 py-5 text-right">ລາຍໄດ້</th>
                        <th className="px-8 py-5">ແຖບລາຍໄດ້</th>
                        <th className="px-8 py-5 text-right">ຕົ້ນທຶນ</th>
                        <th className="px-8 py-5 text-right">ກຳໄລ</th>
                        <th className="px-8 py-5">ແຖບກຳໄລ</th>
                        <th className="px-8 py-5 text-right font-medium">ລາຍການບິນ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {reportData.map((day, idx) => (
                        <tr 
                          key={idx} 
                          onClick={() => reportViewMode === 'daily' && setSelectedReportDay(day.date)}
                          className={cn(
                            "hover:bg-white/[0.02] transition-colors group",
                            reportViewMode === 'daily' && "cursor-pointer"
                          )}
                        >
                          <td className="px-8 py-5 text-white/40 font-mono text-xs">{day.date}</td>
                          <td className="px-8 py-5 text-right font-black text-indigo-400">
                            <span className="text-[10px] mr-1 opacity-50">₭</span>
                            {day.revenue.toLocaleString()}
                          </td>
                          <td className="px-8 py-5 min-w-[140px]">
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, (day.revenue / (kpiStats.revenue / reportData.length)) * 100)}%` }}
                                className="h-full bg-indigo-500/30"
                              />
                            </div>
                          </td>
                          <td className="px-8 py-5 text-right font-bold text-amber-500/80">
                            <span className="text-[10px] mr-1 opacity-50">₭</span>
                            {day.cost.toLocaleString()}
                          </td>
                          <td className="px-8 py-5 text-right font-black text-emerald-400">
                            <span className="text-[10px] mr-1 opacity-50">₭</span>
                            {day.profit.toLocaleString()}
                          </td>
                          <td className="px-8 py-5 min-w-[140px]">
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, (day.profit / (kpiStats.profit / reportData.length)) * 100)}%` }}
                                className="h-full bg-emerald-500/40"
                              />
                            </div>
                          </td>
                          <td className="px-8 py-5 text-right">
                            <span className="text-white/30 text-xs font-bold group-hover:text-indigo-400 transition-colors">
                              {day.salesCount} ບິນ
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>
          )}

          {activeTab === 'accounting' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
              <div className="space-y-8 pb-10">
              {/* Config Edit Modal (Focused) */}
              <AnimatePresence>
                {editingConfigField && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setEditingConfigField(null)}
                      className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 20 }}
                      className="relative w-full max-w-sm bg-[#1a1a2e] border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden text-white"
                    >
                      <button 
                         onClick={() => setEditingConfigField(null)}
                         className="absolute top-6 right-6 p-2 text-white/40 hover:text-white transition-colors hover:bg-white/5 rounded-xl"
                      >
                        <X className="w-5 h-5" />
                      </button>

                      <div className="mb-8">
                        <h3 className="text-2xl font-black mb-1">
                          {editingConfigField === 'initialCapital' && 'ແກ້ໄຂຍອດເງິນທຶນ'}
                          {editingConfigField === 'bankTransfer' && 'ແກ້ໄຂຍອດເງິນໂອນ'}
                          {editingConfigField === 'receivables' && 'ແກ້ໄຂຍອດລູກໜີ້ທົ່ວໄປ'}
                          {editingConfigField === 'receivablesMedical' && 'ແກ້ໄຂຍອດລູກໜີ້ຄ່າຍາ'}
                          {editingConfigField === 'circulatingMoney' && 'ແກ້ໄຂຍອດເງິນໝູນວຽນ'}
                        </h3>
                        <p className="text-white/40 font-medium">ປ້ອນຍອດເງິນປັດຈຸບັນ</p>
                      </div>
                      
                      <form onSubmit={handleUpdateAccountingConfig} className="space-y-6">
                        <div>
                          <label className="block text-[10px] font-black text-white/30 uppercase tracking-widest mb-3">ຈຳນວນເງິນ</label>
                          <div className="relative">
                            <input 
                              name="value"
                              type="number"
                              step="any"
                              defaultValue={accountingConfig[editingConfigField]}
                              autoFocus
                              required
                              className="w-full bg-white/5 border-2 border-white/10 rounded-2xl px-6 py-5 text-2xl font-black focus:outline-none focus:border-emerald-500/50 transition-all text-emerald-400 placeholder:text-white/10"
                              placeholder="0"
                            />
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-white/20 font-bold">KIP</div>
                          </div>
                        </div>

                        <div className="flex gap-3 justify-end pt-2">
                          <button 
                            type="button"
                            onClick={() => setEditingConfigField(null)}
                            className="px-6 py-4 rounded-2xl text-sm font-bold text-white/60 bg-white/5 hover:bg-white/10 transition-colors"
                          >
                            ຍົກເລີກ
                          </button>
                          <button 
                            type="submit"
                            className="px-8 py-4 rounded-2xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                          >
                            ບັນທຶກ
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* Performance Summary Section */}
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black uppercase tracking-tighter">ສະຫຼຸບຜົນປະກອບການ</h2>
                    <p className="text-xs font-bold text-white/40 uppercase tracking-widest">ສຳລັບເດືອນທີ່ເລືອກ</p>
                  </div>
                  <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-fit">
                    <Calendar className="w-4 h-4 text-indigo-400" />
                    <select 
                      value={selectedAccountingMonth}
                      onChange={(e) => setSelectedAccountingMonth(e.target.value)}
                      className="bg-transparent text-sm font-bold focus:outline-none cursor-pointer"
                    >
                      {/* Generate some recent months without end-of-month wrapping bugs */}
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => {
                        const d = new Date();
                        d.setDate(1);
                        d.setMonth(d.getMonth() - i);
                        const val = d.toISOString().slice(0, 7);
                        return <option key={val} value={val} className="bg-[#1c1c2e]">{val}</option>
                      })}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { label: 'ເງິນໝູນວຽນ', value: monthlySummary.circulating, icon: ArrowRightLeft, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                    { label: 'ຍອດຍົກມາ', value: monthlySummary.broughtForward, icon: FileText, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { label: 'ລາຍຮັບ', value: monthlySummary.income, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { label: 'ລວມ', value: monthlySummary.total, icon: PlusCircle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                    { label: 'ລາຍຈ່າຍ', value: monthlySummary.expense, icon: TrendingDown, color: 'text-rose-400', bg: 'bg-rose-500/10' },
                    { label: 'ຄົງເຫຼືອ', value: monthlySummary.balance, icon: Wallet, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { label: 'ກຳໄລ (ເດືອນ)', value: monthlySummary.profit, icon: Equal, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                    { label: 'ຍອດທ້າຍເດືອນ', value: monthlySummary.monthEnd, icon: PiggyBank, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                  ].map((card, i) => (
                    <Card key={i} className={cn("border-white/5 p-6 relative overflow-hidden group", card.bg)}>
                      <div className="absolute top-4 right-4 opacity-20 group-hover:opacity-40 transition-all">
                        <card.icon className={cn("w-8 h-8", card.color)} />
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-xs font-bold text-white/40 uppercase tracking-widest">{card.label}</div>
                        {card.label === 'ເງິນໝູນວຽນ' && (
                          <button 
                            onClick={() => setEditingConfigField('circulatingMoney')}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
                          >
                            <Settings className="w-3 h-3 text-white/40" />
                          </button>
                        )}
                      </div>
                      <div className={card.color}>
                        <span className="text-3xl font-black leading-none tracking-tighter">
                          {card.value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="h-px bg-white/5 my-8" />

              {/* Balance Cards */}
              {/* Accounting Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
                {[
                  { label: '1 ເງິນສົດ', value: totalCashCalc, icon: Wallet, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                  { label: '2 ເງິນໂອນ', value: accountingConfig.bankTransfer, icon: Landmark, color: 'text-indigo-400', bg: 'bg-indigo-500/10', field: 'bankTransfer' },
                  { label: '3 ລວມເງິນ', value: totalCashCalc + accountingConfig.bankTransfer, icon: ArrowRightLeft, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                  { 
                    label: '4 ລູກໜີ້ທົ່ວໄປ', 
                    value: generalDebtors, 
                    icon: Users, 
                    color: 'text-amber-400', 
                    bg: 'bg-amber-500/10',
                    action: () => {
                      setActiveTab('debtors');
                      setDebtorsSubTab('general');
                    }
                  },
                  { 
                    label: '5 ຄ່າຂົນສົ່ງຄົງເຫຼືອ', 
                    value: transportRemainingAllMonths, 
                    icon: Truck, 
                    color: 'text-rose-400', 
                    bg: 'bg-rose-500/10',
                    action: () => {
                      setActiveTab('cod');
                    }
                  },
                  { 
                    label: '6 ລູກໜີ້ຄ່າຍາ', 
                    value: medicalDebtors, 
                    icon: UserPlus, 
                    color: 'text-rose-400', 
                    bg: 'bg-rose-500/10',
                    action: () => {
                      setActiveTab('medicine_debtors');
                      setDebtorsSubTab('medicine');
                    }
                  },
                  { 
                    label: '7 ເຈົ້າໜີ້ທົ່ວໄປ', 
                    value: totalCreditors, 
                    icon: UserMinus, 
                    color: 'text-rose-400', 
                    bg: 'bg-rose-500/10',
                    action: () => {
                      setActiveTab('debtors');
                      setDebtorsSubTab('general');
                    }
                  },
                  { 
                    label: '8 ລວມເງິນທັງໝົດ', 
                    value: (totalCashCalc + accountingConfig.bankTransfer + totalDebtors + transportRemainingAllMonths) - totalCreditors, 
                    icon: PiggyBank, 
                    color: 'text-indigo-400', 
                    bg: 'bg-indigo-500/10' 
                  },
                  { 
                    label: '9 ສ່ວນຕ່າງ ຄົງເຫຼືອ ແລະ ລວມເງິນ', 
                    value: monthlySummary.balance - (totalCashCalc + accountingConfig.bankTransfer), 
                    icon: Scale, 
                    color: 'text-white', 
                    bg: 'bg-white/5' 
                  },
                  { label: 'ເງິນໝູນວຽນ', value: accountingConfig.circulatingMoney, icon: RefreshCw, color: 'text-[#8b5cf6]', bg: 'bg-[#8b5cf6]/10', field: 'circulatingMoney' },
                  { label: 'ເງິນທຶນ', value: accountingConfig.initialCapital, icon: Save, color: 'text-amber-400', bg: 'bg-amber-500/10', field: 'initialCapital' },
                ].map((card, i) => (
                  <Card 
                    key={i} 
                    className={cn(
                      "border-white/5 p-5 relative overflow-hidden group min-h-[110px] flex flex-col justify-between transition-all duration-300", 
                      card.bg,
                      (card.field || (card as any).action) ? "cursor-pointer hover:ring-1 hover:ring-white/20 active:scale-[0.98]" : ""
                    )}
                    onClick={() => {
                      if (card.field) {
                        setEditingConfigField(card.field as keyof AccountingConfig);
                      } else if ((card as any).action) {
                        (card as any).action();
                      }
                    }}
                  >
                    <div className="absolute top-4 right-4 opacity-10 group-hover:opacity-30 transition-all scale-125 pointer-events-none">
                      <card.icon className={cn("w-6 h-6", card.color)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-black text-white/30 uppercase tracking-widest">{card.label}</div>
                      {card.field && (
                        <div className="p-2 hover:bg-white/10 rounded-xl transition-all bg-white/5 border border-white/10">
                          <Settings className="w-3.5 h-3.5 text-white/60" />
                         </div>
                       )}
                    </div>
                    <div className={card.color}>
                      <div className="text-2xl font-black leading-none tracking-tighter mb-1">
                        {card.value.toLocaleString()}
                      </div>
                      {card.label === 'ສ່ວນຕ່າງ ຄົງເຫຼືອ ແລະ ລວມເງິນ' && (
                        <div className={cn(
                          "text-[8px] font-bold uppercase py-0.5 px-1.5 rounded w-fit",
                          card.value >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                        )}>
                          {card.value >= 0 ? 'ກຳໄລ' : 'ຂາດທຶນ'}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Form & Calculator */}
                <div className="lg:col-span-1 space-y-8">
                  {/* Add Transaction Form */}
                  <Card className="bg-[#1c1c2e] border-white/5">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                       <Plus className="w-5 h-5 text-indigo-400" />
                       ເພີ່ມທຸລະກຳ
                    </h3>
                    <form onSubmit={handleAddTransaction} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-white/40 uppercase mb-2">ປະເພດທຸລະກຳ</label>
                          <div className="flex gap-4 p-2 bg-white/5 rounded-xl border border-white/5">
                            <label className="flex-1 flex items-center justify-center gap-2 cursor-pointer group py-1">
                              <input type="radio" name="type" value="income" defaultChecked className="hidden peer" />
                              <div className="w-3 h-3 rounded-full border border-white/10 peer-checked:border-emerald-500 peer-checked:bg-emerald-500 transition-all" />
                              <span className="text-[10px] font-bold text-white/40 peer-checked:text-white transition-colors uppercase">ຮັບ</span>
                            </label>
                            <label className="flex-1 flex items-center justify-center gap-2 cursor-pointer group py-1">
                              <input type="radio" name="type" value="expense" className="hidden peer" />
                              <div className="w-3 h-3 rounded-full border border-white/10 peer-checked:border-rose-500 peer-checked:bg-rose-500 transition-all" />
                              <span className="text-[10px] font-bold text-white/40 peer-checked:text-white transition-colors uppercase">ຈ່າຍ</span>
                            </label>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-white/40 uppercase mb-2">ທຸລະກິດ</label>
                          <select 
                            name="businessType"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-bold focus:outline-none focus:border-indigo-500/50 appearance-none bg-no-repeat bg-[right_0.5rem_center] cursor-pointer"
                          >
                            {BUSINESS_TYPES.map(b => (
                              <option key={b.id} value={b.id} className="bg-[#1c1c2e]">{b.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-white/40 uppercase mb-2">ວັນທີ</label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30" />
                            <input 
                              name="date"
                              type="date" 
                              required
                              defaultValue={new Date().toISOString().split('T')[0]}
                              className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-2 text-[10px] font-bold focus:outline-none focus:border-indigo-500/50"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-white/40 uppercase mb-2">ໝວດໝູ່</label>
                          <select 
                            name="category"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-bold focus:outline-none focus:border-indigo-500/50 appearance-none bg-no-repeat bg-[right_0.5rem_center] cursor-pointer"
                          >
                            {ACCOUNTING_CATEGORIES.map(c => (
                              <option key={c} value={c} className="bg-[#1c1c2e]">{c}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-white/40 uppercase mb-2">ຈຳນວນເງິນ</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-white/20">₭</span>
                          <input 
                            name="amount"
                            type="number" 
                            required
                            placeholder="0"
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-sm font-black focus:outline-none focus:border-indigo-500/50 text-indigo-400"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-white/40 uppercase mb-2">ຄຳອະທິບາຍ</label>
                        <textarea 
                          name="description"
                          rows={2}
                          placeholder="ອະທິບາຍລາຍການ..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-bold focus:outline-none focus:border-indigo-500/50 resize-none opacity-80"
                        ></textarea>
                      </div>

                      <Button type="submit" className="w-full py-4 flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/10 active:scale-95 transition-all">
                        <PlusCircle className="w-5 h-5" />
                        ເພີ່ມທຸລະກຳ
                      </Button>
                    </form>
                  </Card>

                  {/* Cash Calculator */}
                  <Card className="bg-[#1c1c2e] border-white/5">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                       <Wallet className="w-5 h-5 text-indigo-400" />
                       ເຄື່ອງຄິດໄລ່ເງິນສົດ
                    </h3>
                    <div className="space-y-4">
                      {[100000, 50000, 20000, 10000, 5000, 2000, 1000].map(val => (
                        <div key={val} className="flex items-center gap-4">
                          <label className="text-[10px] font-bold text-white/40 uppercase w-20">{val.toLocaleString()}</label>
                          <input 
                            type="number"
                            value={cashCalc[val] || ''}
                            onChange={(e) => handleUpdateCashCalc({ [val]: Number(e.target.value) })}
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-center"
                            placeholder="0"
                          />
                          <span className="text-[10px] font-mono text-indigo-400 w-24 text-right">
                            {((cashCalc[val] || 0) * val).toLocaleString()}
                          </span>
                        </div>
                      ))}
                      <div className="h-px bg-white/5 my-4" />
                      <div className="flex items-center gap-4">
                        <label className="text-[10px] font-bold text-amber-500 uppercase w-20">BAHT</label>
                        <input 
                          type="number"
                          value={cashCalc.baht || ''}
                          onChange={(e) => handleUpdateCashCalc({ baht: Number(e.target.value) })}
                          className="flex-1 bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-1.5 text-xs text-center text-amber-500"
                          placeholder="0"
                        />
                        <input 
                          type="number"
                          value={cashCalc.bahtRate || ''}
                          onChange={(e) => handleUpdateCashCalc({ bahtRate: Number(e.target.value) })}
                          className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-center"
                          placeholder="Rate"
                        />
                        <span className="text-[10px] font-mono text-amber-500 w-24 text-right">
                          {(cashCalc.baht * cashCalc.bahtRate).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="text-[10px] font-bold text-emerald-500 uppercase w-20">USD</label>
                        <input 
                          type="number"
                          value={cashCalc.usd || ''}
                          onChange={(e) => handleUpdateCashCalc({ usd: Number(e.target.value) })}
                          className="flex-1 bg-emerald-500/5 border border-emerald-500/10 rounded-lg px-3 py-1.5 text-xs text-center text-emerald-500"
                          placeholder="0"
                        />
                        <input 
                          type="number"
                          value={cashCalc.usdRate || ''}
                          onChange={(e) => handleUpdateCashCalc({ usdRate: Number(e.target.value) })}
                          className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-center"
                          placeholder="Rate"
                        />
                        <span className="text-[10px] font-mono text-emerald-400 w-24 text-right">
                          {(cashCalc.usd * cashCalc.usdRate).toLocaleString()}
                        </span>
                      </div>
                      <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                        <span className="text-sm font-bold uppercase tracking-widest text-white/40">ລວມທັງໝົດ (KIP)</span>
                        <span className="text-2xl font-black text-emerald-400">{totalCashCalc.toLocaleString()}</span>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Right Column: Overview & History */}
                <div className="lg:col-span-2 space-y-8">
                  {/* Transaction History (Collapsible) */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                       <h3 className="text-lg font-bold flex items-center gap-2">
                         <History className="w-5 h-5 text-indigo-400" />
                         ປະຫວັດທຸລະກຳ (ລາຍວັນ)
                       </h3>
                       <div className="flex items-center gap-4">
                         <div className="relative group">
                           <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 group-hover:text-indigo-400 transition-colors" />
                           <input 
                             type="month" 
                             value={selectedAccountingMonth}
                             onChange={(e) => setSelectedAccountingMonth(e.target.value)}
                             className="bg-white/5 border border-white/10 rounded-lg pl-7 pr-3 py-1.5 text-[10px] font-bold text-white/60 focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer hover:bg-white/10 transition-all"
                           />
                         </div>
                         <button 
                           onClick={handleClearTransactions}
                           className="text-[10px] font-bold text-rose-500 uppercase tracking-widest hover:text-rose-400 bg-rose-500/5 px-3 py-1.5 rounded-lg border border-rose-500/10 transition-all active:scale-95"
                         >
                           ລົບລາຍການເດືອນນີ້
                         </button>
                       </div>
                    </div>
                    
                    <div className="space-y-4">
                      {accountingDailySummaries.map((summary) => (
                        <Card key={summary.date} className="p-0 overflow-hidden border-white/5 bg-[#161623]/30">
                          <button 
                            onClick={() => toggleDate(`daily-${summary.date}`)}
                            className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors group"
                          >
                            <div className="flex items-center gap-4">
                              <div className="p-2 rounded-lg bg-white/5 text-white/40 group-hover:text-white transition-colors">
                                {expandedDates[`daily-${summary.date}`] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </div>
                              <div>
                                <div className="text-sm font-black text-white/80">ວັນທີ {summary.date}</div>
                                <div className="text-[10px] font-bold text-white/20 uppercase">
                                  {summary.entries.length} ລາຍການ
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-6 text-right">
                              <div>
                                <div className="text-[9px] font-bold text-white/20 uppercase mb-1">ຮັບ</div>
                                <div className="text-sm font-black text-emerald-400">+{summary.totalIncome.toLocaleString()}</div>
                              </div>
                              <div>
                                <div className="text-[9px] font-bold text-white/20 uppercase mb-1">ຈ່າຍ</div>
                                <div className="text-sm font-black text-rose-400">-{summary.totalExpense.toLocaleString()}</div>
                              </div>
                            </div>
                          </button>

                          <AnimatePresence>
                            {expandedDates[`daily-${summary.date}`] && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="overflow-x-auto border-t border-white/5 bg-white/[0.01]">
                                  <table className="w-full text-left">
                                    <thead className="text-[9px] font-black uppercase tracking-widest text-white/20 bg-white/5">
                                      <tr>
                                        <th className="px-6 py-3">ລາຍລະອຽດ</th>
                                        <th className="px-6 py-3 text-right">ຈຳນວນເງິນ</th>
                                        <th className="px-6 py-3 text-center">ຈັດການ</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                      {summary.entries.map(item => {
                                        const isTransaction = 'note' in item && !('orderNo' in item);
                                        const isMedicineDebtor = 'orderNo' in item;
                                        return (
                                          <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="px-6 py-4">
                                              <div className="flex items-center gap-2 mb-1">
                                                <div className="text-sm font-bold text-white/80">
                                                  {isTransaction ? (item as Transaction).note : (isMedicineDebtor ? (item as MedicineDebtorEntry).name : (item as DebtorEntry).description)}
                                                </div>
                                                {isTransaction ? (
                                                  <>
                                                    <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-white/5 text-white/40">{(item as Transaction).category}</span>
                                                    <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400/80">{(item as Transaction).businessType}</span>
                                                  </>
                                                ) : isMedicineDebtor ? (
                                                  <>
                                                    <span className={cn(
                                                      "text-[8px] font-black uppercase px-2 py-0.5 rounded border border-emerald-500/20",
                                                      (item as MedicineDebtorEntry).isPaid ? "bg-white/5 text-white/40" : "bg-[#10b981]/10 text-emerald-400"
                                                    )}>
                                                      ລູກໜີ້ຄ່າຢາ
                                                    </span>
                                                    <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-white/5 text-white/40">
                                                      {(item as MedicineDebtorEntry).isPaid ? 'ຊຳລະແລ້ວ' : 'ຄ້າງຊຳລະ'}
                                                    </span>
                                                  </>
                                                ) : (
                                                  <span className={cn(
                                                    "text-[8px] font-black uppercase px-2 py-0.5 rounded",
                                                    (item as DebtorEntry).type === 'debtor' ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                                                  )}>
                                                    {(item as DebtorEntry).type === 'debtor' ? 'ລູກໜີ້' : 'ເຈົ້າໜີ້'}
                                                  </span>
                                                )}
                                              </div>
                                              <div className="text-[9px] font-mono text-white/20 uppercase">
                                                {isMedicineDebtor ? `ລຳດັບ: ${(item as MedicineDebtorEntry).orderNo}${ (item as MedicineDebtorEntry).note ? ` - ${ (item as MedicineDebtorEntry).note}` : '' }` : item.id}
                                              </div>
                                            </td>
                                            <td className={cn(
                                              "px-6 py-4 text-right font-black text-sm",
                                              isTransaction 
                                                ? ((item as Transaction).type === 'income' ? "text-emerald-400" : "text-rose-400")
                                                : isMedicineDebtor
                                                  ? ((item as MedicineDebtorEntry).isPaid ? "text-white/40" : "text-rose-400")
                                                  : ((item as DebtorEntry).type === 'debtor' ? "text-emerald-400" : "text-rose-400")
                                            )}>
                                              {isTransaction 
                                                ? (((item as Transaction).type === 'income' ? '+' : '-') + (item as Transaction).amount.toLocaleString())
                                                : isMedicineDebtor
                                                  ? (((item as MedicineDebtorEntry).cost + ((item as MedicineDebtorEntry).sellingPrice - (item as MedicineDebtorEntry).cost) * 0.4).toLocaleString())
                                                  : ((item as DebtorEntry).amount.toLocaleString())
                                              }
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                              <div className="flex items-center justify-center gap-2">
                                                <button 
                                                  onClick={() => {
                                                    if (isTransaction) {
                                                      setEditingTransactionId(item.id);
                                                    } else if (isMedicineDebtor) {
                                                      setActiveTab('medicine_debtors');
                                                    } else {
                                                      setEditingDebtorId(item.id);
                                                    }
                                                  }}
                                                  className="p-1.5 text-white/20 hover:text-indigo-400 transition-colors bg-white/5 rounded-lg"
                                                >
                                                  <Edit className="w-3.5 h-3.5" />
                                                </button>
                                                <button 
                                                  onClick={() => {
                                                    if (isTransaction) {
                                                      handleDeleteTransaction(item.id);
                                                    } else if (isMedicineDebtor) {
                                                      handleDeleteMedicineItem(item.id);
                                                    } else {
                                                      handleDeleteDebtor(item.id);
                                                    }
                                                  }}
                                                  className="p-1.5 text-white/20 hover:text-rose-500 transition-colors bg-rose-500/5 rounded-lg"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </Card>
                      ))}
                      {accountingDailySummaries.length === 0 && (
                         <div className="py-20 text-center text-white/10 italic font-bold">ບໍ່ມີຂໍ້ມູນທຸລະກຳໃນເດືອນນີ້</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}

          {activeTab === 'cod' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
              <div className="space-y-8 pb-10">
              <AnimatePresence mode="wait">
                {!selectedCodCategory ? (
                  <motion.div 
                    key="summary"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-8"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter">ຈັດການ COD & ຂົນສົ່ງ</h2>
                        <p className="text-xs font-bold text-white/40 uppercase tracking-widest">ສຳລັບເດືອນ: {selectedAccountingMonth}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-fit">
                          <Calendar className="w-4 h-4 text-indigo-400" />
                          <select 
                            value={selectedAccountingMonth}
                            onChange={(e) => setSelectedAccountingMonth(e.target.value)}
                            className="bg-transparent text-sm font-bold focus:outline-none cursor-pointer"
                          >
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => {
                              const d = new Date();
                              d.setDate(1);
                              d.setMonth(d.getMonth() - i);
                              const val = d.toISOString().slice(0, 7);
                              return <option key={val} value={val} className="bg-[#1c1c2e]">{val}</option>
                            })}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                      <Card className="bg-blue-500/10 border-blue-500/20 p-4">
                        <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">ລວມຈຳນວນເງິນ</div>
                        <div className="text-xl font-black">{transportStats.totalAmount.toLocaleString()}</div>
                      </Card>
                      <Card className="bg-orange-500/10 border-orange-500/20 p-4">
                        <div className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1">ລວມຕົ້ນທຶນ</div>
                        <div className="text-xl font-black">{transportStats.totalCost.toLocaleString()}</div>
                      </Card>
                      <Card className="bg-emerald-500/10 border-emerald-500/20 p-4">
                        <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">ກຳໄລລວມ</div>
                        <div className="text-xl font-black">{transportStats.profit.toLocaleString()}</div>
                      </Card>
                      <Card className="bg-rose-500/10 border-rose-500/20 p-4">
                        <div className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1">ຄົງເຫຼືອຄ້າງຈ່າຍ</div>
                        <div className="text-xl font-black">{transportStats.remaining.toLocaleString()}</div>
                      </Card>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {(['ANS', 'HAL', 'MX', 'COD'] as const).map(type => {
                        const typeEntries = filteredTransportEntries.filter(e => e.type === type);
                        const typeTotal = typeEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
                        const typeRemaining = typeEntries.filter(e => !e.finished).reduce((sum, e) => sum + (e.amount || 0), 0);
                        const typeUnfinishedCount = typeEntries.filter(e => !e.finished).length;
                        
                        const typePotentialProfit = typeEntries.reduce((sum, e) => sum + ((e.amount || 0) - ((e.cost || 0) * (e.quantity || 1))), 0);
                        const typeCompletedProfit = typeEntries.filter(e => e.finished).reduce((sum, e) => sum + ((e.amount || 0) - ((e.cost || 0) * (e.quantity || 1))), 0);

                        return (
                          <Card 
                            key={type} 
                            onClick={() => setSelectedCodCategory(type)}
                            className={cn(
                              "relative overflow-hidden cursor-pointer group active:scale-95 transition-all p-5 border-white/5",
                              type === 'ANS' && "bg-blue-500/5 hover:bg-blue-500/10",
                              type === 'HAL' && "bg-emerald-500/5 hover:bg-emerald-500/10",
                              type === 'MX' && "bg-orange-500/5 hover:bg-orange-500/10",
                              type === 'COD' && "bg-indigo-500/5 hover:bg-indigo-500/10"
                            )}
                          >
                            <div className="absolute top-4 right-4 opacity-10 group-hover:opacity-30 transition-opacity">
                              <Truck className="w-10 h-10" />
                            </div>
                            <div className="flex justify-between items-start mb-4">
                              <h3 className={cn(
                                "text-xl font-black uppercase tracking-tighter",
                                type === 'ANS' && "text-blue-400",
                                type === 'HAL' && "text-emerald-400",
                                type === 'MX' && "text-orange-400",
                                type === 'COD' && "text-indigo-400"
                              )}>
                                {type}
                              </h3>
                              <div className={cn(
                                "text-[10px] font-black px-2 py-0.5 rounded bg-black/20",
                                typeUnfinishedCount === 0 ? "text-emerald-400" : "text-rose-400"
                              )}>
                                ຄ້າງ {typeUnfinishedCount}/{typeEntries.length}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-[10px] font-bold uppercase">
                                <span className="text-white/40">ລວມເງິນ:</span>
                                <span>{typeTotal.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-[10px] font-bold uppercase">
                                <span className="text-rose-500">ຄ້າງຈ່າຍ:</span>
                                <span>{typeRemaining.toLocaleString()}</span>
                              </div>
                              <div className="pt-2 border-t border-white/5 space-y-1">
                                <div className="flex justify-between text-[10px] font-bold uppercase">
                                  <span className="text-white/20">ກຳໄລລວມ:</span>
                                  <span className="text-white/60">{typePotentialProfit.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-[10px] font-bold uppercase">
                                  <span className="text-emerald-400/50">ກຳໄລຈິງ:</span>
                                  <span className="text-emerald-400">{typeCompletedProfit.toLocaleString()}</span>
                                </div>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>

                    {/* COD & Transport Profits Chart Section */}
                    <Card className="bg-[#1e1e2e]/30 border-white/5 p-6">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                        <div>
                          <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-indigo-400" />
                            ສະຖິຕິກຳໄລ COD & ຂົນສົ່ງ
                          </h3>
                          <p className="text-xs text-white/40 font-bold uppercase tracking-widest mt-0.5">
                            ກຳໄລລວມທັງໝົດ: {codChartData.monthly.reduce((sum, item) => sum + item.profit, 0).toLocaleString()} ກີບ
                          </p>
                        </div>
                        
                        <div className="flex bg-white/5 border border-white/10 p-1 rounded-xl">
                          <button
                            onClick={() => setCodChartType('monthly')}
                            className={cn(
                              "px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                              codChartType === 'monthly'
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                                : "text-white/60 hover:text-white"
                            )}
                          >
                            ລາຍເດືອນ
                          </button>
                          <button
                            onClick={() => setCodChartType('yearly')}
                            className={cn(
                              "px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                              codChartType === 'yearly'
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                                : "text-white/60 hover:text-white"
                            )}
                          >
                            ລາຍປີ
                          </button>
                        </div>
                      </div>

                      <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={codChartType === 'monthly' ? codChartData.monthly : codChartData.yearly}
                            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                            <XAxis 
                              dataKey={codChartType === 'monthly' ? 'month' : 'year'} 
                              stroke="rgba(255,255,255,0.3)" 
                              fontSize={10}
                              tickLine={false}
                              axisLine={false}
                              dy={10}
                              fontFamily="JetBrains Mono"
                            />
                            <YAxis 
                              stroke="rgba(255,255,255,0.3)" 
                              fontSize={10}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(value) => `${(value / 1000).toLocaleString()}k`}
                              fontFamily="JetBrains Mono"
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-[#151521] border border-white/10 p-3 rounded-xl shadow-xl backdrop-blur-md">
                                      <div className="text-xs font-bold text-white/40 mb-2 font-mono">
                                        {codChartType === 'monthly' ? data.month : data.year}
                                      </div>
                                      <div className="space-y-1">
                                        <div className="flex justify-between gap-6 text-xs">
                                          <span className="text-blue-400 font-bold">ລວມຍອດ COD:</span>
                                          <span className="font-bold text-white font-mono">{(data.amount || 0).toLocaleString()} ກີບ</span>
                                        </div>
                                        <div className="flex justify-between gap-6 text-xs">
                                          <span className="text-orange-400 font-bold">ຕົ້ນທຶນ:</span>
                                          <span className="font-bold text-white font-mono">{(data.cost || 0).toLocaleString()} ກີບ</span>
                                        </div>
                                        <div className="flex justify-between gap-6 text-xs pt-1 border-t border-white/5">
                                          <span className="text-emerald-400 font-extrabold">ກຳໄລຈິງ:</span>
                                          <span className="font-extrabold text-emerald-400 font-mono">{(data.profit || 0).toLocaleString()} ກີບ</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Area 
                              name="ກຳໄລ"
                              type="monotone" 
                              dataKey="profit" 
                              stroke="#10b981" 
                              strokeWidth={3}
                              fillOpacity={1} 
                              fill="url(#colorProfit)" 
                            />
                            <Area 
                              name="ຍອດທັງໝົດ"
                              type="monotone" 
                              dataKey="amount" 
                              stroke="#3b82f6" 
                              strokeWidth={1.5}
                              strokeDasharray="4 4"
                              fillOpacity={1} 
                              fill="url(#colorAmount)" 
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="details"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                   >
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setSelectedCodCategory(null)}
                        className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
                           <span className={cn(
                              selectedCodCategory === 'ANS' && "text-blue-400",
                              selectedCodCategory === 'HAL' && "text-emerald-400",
                              selectedCodCategory === 'MX' && "text-orange-400",
                              selectedCodCategory === 'COD' && "text-indigo-400"
                           )}>
                             {selectedCodCategory}
                           </span>
                           <span className="text-white/20">/</span>
                           ລາຍລະອຽດທຸລະກຳ
                        </h2>
                        <p className="text-xs font-bold text-white/40 uppercase tracking-widest">{selectedAccountingMonth}</p>
                      </div>
                    </div>

                    {/* Detail Card for Selected Category */}
                    {(() => {
                      const type = selectedCodCategory;
                      const typeEntries = filteredTransportEntries.filter(e => e.type === type);
                      const typeTotal = typeEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
                      const typeRemaining = typeEntries.filter(e => !e.finished).reduce((sum, e) => sum + (e.amount || 0), 0);
                      const typeUnfinishedCount = typeEntries.filter(e => !e.finished).length;

                      return (
                        <Card key={type || 'details'} className="p-0 overflow-hidden border-white/5 bg-[#161623]/30">
                          <div className={cn(
                            "p-4 border-b border-white/5 flex items-center justify-between",
                            type === 'ANS' && "bg-blue-500/5",
                            type === 'HAL' && "bg-emerald-500/5",
                            type === 'MX' && "bg-orange-500/5",
                            type === 'COD' && "bg-indigo-500/5"
                          )}>
                            <div>
                               <div className="flex gap-4">
                                <span className="text-[10px] font-bold text-white/40 uppercase">ລວມ: {typeTotal.toLocaleString()}</span>
                                <span className="text-[10px] font-bold text-rose-500 uppercase">ຄົງເຫຼືອ: {typeRemaining.toLocaleString()}</span>
                                <span className={cn(
                                  "text-[10px] font-bold uppercase",
                                  typeUnfinishedCount === 0 ? "text-emerald-400" : "text-rose-500"
                                )}>/ ຄ້າງ {typeUnfinishedCount}/{typeEntries.length} ລາຍການ</span>
                                <span className="text-[10px] font-bold text-emerald-400 uppercase">ກຳໄລ: {typeEntries.reduce((sum, e) => sum + ((e.amount || 0) - ((e.cost || 0) * (e.quantity || 1))), 0).toLocaleString()}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="danger" 
                                size="sm" 
                                className="text-[10px] uppercase font-black tracking-widest flex items-center gap-2 h-8 px-3"
                                onClick={() => type && handleClearCategoryEntries(type)}
                              >
                                <Trash2 className="w-4 h-4" />
                                ລົບທັງໝົດ
                              </Button>
                              <Button 
                                variant="secondary" 
                                size="sm" 
                                className="text-[10px] uppercase font-black tracking-widest flex items-center gap-2 h-8 px-3"
                                onClick={() => {
                                  if (!type) return;
                                  setTransportModalData(prev => ({ 
                                    ...prev, 
                                    type: type as any, 
                                    date: new Date().toISOString().split('T')[0],
                                    items: [{ id: Date.now(), detail: '', cost: 0, quantity: 1, amount: 0, productId: '' }] 
                                  }));
                                  setIsTransportModalOpen(true);
                                }}
                              >
                                <PlusCircle className="w-4 h-4" />
                                ເເພີ່ມລາຍການຂົນສົ່ງ
                              </Button>
                            </div>
                          </div>

                          {/* Data Lists by Day */}
                          <div className="space-y-4 p-4">
                            {(() => {
                              const days = Array.from(new Set(typeEntries.map(e => startOfDay(e.date).getTime()))).sort((a, b) => (b as number) - (a as number));
                              const summaryByDay = days.map(day => ({
                                date: new Date(day as number),
                                total: typeEntries.filter(e => startOfDay(e.date).getTime() === (day as number)).reduce((sum, e) => sum + (e.amount || 0), 0)
                              }));

                              return summaryByDay.map(summary => {
                                const summaryEntries = typeEntries.filter(e => startOfDay(e.date).getTime() === summary.date.getTime());
                                const groupKey = `${type}-${summary.date.getTime()}`;
                                const isExpanded = expandedDates[groupKey];
                                const dayRemaining = summaryEntries.filter(e => !e.finished).reduce((sum, e) => sum + (e.amount || 0), 0);

                                return (
                                  <div key={summary.date.getTime()} className="space-y-2">
                                    <button 
                                      onClick={() => toggleDate(groupKey)}
                                      className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all text-left"
                                    >
                                      <div className="flex items-center gap-4">
                                        <div className={cn(
                                          "w-8 h-8 rounded-full flex items-center justify-center bg-white/5",
                                          isExpanded && "rotate-180 transition-transform"
                                        )}>
                                          <ChevronDown className="w-4 h-4 text-white/40" />
                                        </div>
                                        <span className="text-xs font-black uppercase tracking-widest text-white/60">ວັນທີ {format(summary.date, 'dd/MM/yyyy')}</span>
                                      </div>
                                      <div className="flex gap-4 items-center">
                                        <span className={cn(
                                          "text-[10px] font-bold uppercase",
                                          dayRemaining > 0 ? "text-rose-400 font-extrabold" : "text-emerald-400"
                                        )}>
                                          ຄົງເຫຼືອ: {dayRemaining.toLocaleString()}
                                        </span>
                                        <span className={cn(
                                          "text-[10px] font-bold uppercase",
                                          summaryEntries.filter(e => !e.finished).length === 0 ? "text-emerald-500/60" : "text-white/40"
                                        )}>
                                          / ຄ້າງ {summaryEntries.filter(e => !e.finished).length}/{summaryEntries.length}
                                        </span>
                                        <span className="text-[10px] font-bold text-emerald-400 uppercase">ກຳໄລ: {summaryEntries.reduce((sum, e) => sum + ((e.amount || 0) - ((e.cost || 0) * (e.quantity || 1))), 0).toLocaleString()}</span>
                                      </div>
                                    </button>
                                    
                                    <AnimatePresence>
                                      {isExpanded && (
                                        <motion.div 
                                          initial={{ height: 0, opacity: 0 }}
                                          animate={{ height: 'auto', opacity: 1 }}
                                          exit={{ height: 0, opacity: 0 }}
                                          className="overflow-hidden"
                                        >
                                          <div className="bg-black/20 rounded-2xl border border-white/5 overflow-x-auto">
                                            <table className="w-full">
                                              <thead>
                                                <tr className="text-[10px] font-black text-white/20 uppercase tracking-widest border-b border-white/5">
                                                  <th className="px-4 py-2 text-left">ລາຍລະອຽດ</th>
                                                  <th className="px-4 py-2 text-right">ຕົ້ນທຶນ</th>
                                                  <th className="px-4 py-2 text-center">ຈຳນວນ</th>
                                                  <th className="px-4 py-2 text-right">ຈຳນວນເງິນ</th>
                                                  <th className="px-4 py-2 text-right">ກຳໄລ</th>
                                                  <th className="px-4 py-2 text-center">ສຳເລັດ</th>
                                                  <th className="px-4 py-2 text-center">ລົບ</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-white/5">
                                                {summaryEntries.map(entry => {
                                                  const entryProfit = (entry.amount || 0) - ((entry.cost || 0) * (entry.quantity || 1));
                                                  return (
                                                    <tr key={entry.id} className="hover:bg-white/[0.02] transition-colors">
                                                      <td className="px-4 py-2">
                                                        <div className="flex items-center gap-2">
                                                          {(() => {
                                                            const selectedProduct = products.find(p => p.id === entry.productId);
                                                            return selectedProduct?.image ? (
                                                              <div 
                                                                className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-black/20 border border-white/10 cursor-pointer hover:scale-105 transition-transform"
                                                                onClick={() => {
                                                                  if (selectedProduct.image) {
                                                                    const w = window.open();
                                                                    w?.document.write(`<img src="${selectedProduct.image}" style="max-width:100%; max-height:100vh; display:block; margin:auto;" />`);
                                                                  }
                                                                }}
                                                                title="ຄລິກເພື່ອເບິ່ງຮູບໃຫຍ່"
                                                              >
                                                                <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-cover" />
                                                              </div>
                                                            ) : null;
                                                          })()}
                                                          <div className="relative group/select flex-1 flex flex-col gap-0.5">
                                                            <input 
                                                              type="text"
                                                              value={entry.detail || ''}
                                                              onChange={(e) => handleUpdateTransportEntry(entry.id, { detail: e.target.value })}
                                                              className="w-full bg-transparent border-none text-xs font-bold focus:ring-0 p-0 text-white"
                                                              placeholder="ລາຍລະອຽດ..."
                                                            />
                                                            {products.length > 0 && (
                                                              <select 
                                                                value={entry.productId || ""}
                                                                onChange={(e) => {
                                                                  const prodId = e.target.value;
                                                                  const prod = products.find(p => p.id === prodId);
                                                                  if (prod) {
                                                                    handleUpdateTransportEntry(entry.id, { 
                                                                      productId: prod.id,
                                                                      detail: prod.name,
                                                                      cost: prod.cost,
                                                                      amount: prod.price * (entry.quantity || 1)
                                                                    });
                                                                  } else {
                                                                    handleUpdateTransportEntry(entry.id, {
                                                                      productId: '',
                                                                      detail: ''
                                                                    });
                                                                  }
                                                                }}
                                                                className="w-full bg-white/5 border border-white/5 rounded px-1 py-0.5 text-[9px] text-white/30 focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                                                              >
                                                                <option value="" className="bg-[#1c1c2e] text-white/40">-- ດຶງຂໍ້ມູນສິນຄ້າຈາກສາງ --</option>
                                                                {products.map(p => (
                                                                  <option key={p.id} value={p.id} className="bg-[#1c1c2e] text-white text-xs">
                                                                    {p.name}
                                                                  </option>
                                                                ))}
                                                              </select>
                                                            )}
                                                          </div>
                                                        </div>
                                                      </td>
                                                      <td className="px-4 py-2 text-right">
                                                        <input 
                                                          type="number"
                                                          value={entry.cost || ''}
                                                          onChange={(e) => handleUpdateTransportEntry(entry.id, { cost: Number(e.target.value) })}
                                                          className="w-20 bg-transparent border-none text-xs text-right focus:ring-0 p-0"
                                                        />
                                                      </td>
                                                      <td className="px-4 py-2 text-center">
                                                        <input 
                                                          type="number"
                                                          value={entry.quantity || ''}
                                                          onChange={(e) => handleUpdateTransportEntry(entry.id, { quantity: Number(e.target.value) })}
                                                          className="w-10 bg-transparent border-none text-xs text-center focus:ring-0 p-0"
                                                        />
                                                      </td>
                                                      <td className="px-4 py-2 text-right">
                                                        <input 
                                                          type="number"
                                                          value={entry.amount || ''}
                                                          onChange={(e) => handleUpdateTransportEntry(entry.id, { amount: Number(e.target.value) })}
                                                          className="w-24 bg-transparent border-none text-xs text-right font-bold focus:ring-0 p-0 text-indigo-400"
                                                        />
                                                      </td>
                                                      <td className={cn(
                                                        "px-4 py-2 text-right text-xs font-black",
                                                        entryProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                                                      )}>
                                                        {entryProfit.toLocaleString()}
                                                      </td>
                                                      <td className="px-4 py-2 text-center">
                                                        <button 
                                                          onClick={() => handleUpdateTransportEntry(entry.id, { finished: !entry.finished })}
                                                          className={cn(
                                                            "w-5 h-5 rounded flex items-center justify-center transition-colors mx-auto",
                                                            entry.finished ? "bg-emerald-500 text-white" : "bg-white/5 border border-white/10"
                                                          )}
                                                        >
                                                          {entry.finished && <CheckCircle2 className="w-3 h-3" />}
                                                        </button>
                                                      </td>
                                                      <td className="px-4 py-2 text-center">
                                                        <button 
                                                          onClick={() => handleDeleteTransportEntry(entry.id)}
                                                          className="p-2 text-white/40 hover:text-rose-500 transition-colors bg-rose-500/5 rounded-lg"
                                                        >
                                                          <Trash2 className="w-4 h-4" />
                                                        </button>
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </Card>
                      );
                    })()}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          )}

          {(activeTab === 'debtors' || activeTab === 'medicine_debtors') && currentShop !== 'sports' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
              {(activeTab === 'medicine_debtors' || debtorsSubTab === 'medicine') ? (
                <div className="space-y-8 pb-10">
                  {/* Medicine Debtors Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 animate-in fade-in duration-300">
                      <button 
                        onClick={() => {
                          if (activeTab === 'medicine_debtors') {
                            setActiveTab('debtors');
                          }
                          setDebtorsSubTab('general');
                        }}
                        className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 text-white transition-all cursor-pointer shadow-md"
                      >
                        <ArrowLeft className="w-5 h-5 text-indigo-400" />
                      </button>
                      <div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
                          ລູກໜີ້ຄ່າຢາ
                        </h2>
                        <p className="text-xs font-bold text-white/40 uppercase tracking-widest">
                          ຂໍ້ມູນປະຈຳເດືອນ: {selectedMedicineMonth}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-fit">
                        <Calendar className="w-4 h-4 text-indigo-400" />
                        <select 
                          value={selectedMedicineMonth}
                          onChange={(e) => setSelectedMedicineMonth(e.target.value)}
                          className="bg-transparent text-sm font-bold focus:outline-none cursor-pointer text-white"
                        >
                          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => {
                            const d = new Date();
                            d.setDate(1);
                            d.setMonth(d.getMonth() - i);
                            const val = d.toISOString().slice(0, 7);
                            return <option key={val} value={val} className="bg-[#1c1c2e] text-white">{val}</option>
                          })}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Medicine Grid Content */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Form & Statistics */}
                    <div className="lg:col-span-1 space-y-6">
                      {/* Form */}
                      <Card className="border-white/5 bg-[#1c1c2e] p-6 shadow-xl">
                        <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-indigo-400">
                          <PlusCircle className="w-5 h-5 text-indigo-400" />
                          ເພີ່ມລາຍການຢາໃໝ່
                        </h3>
                        <form onSubmit={handleAddMedicineEntry} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-bold text-white/40 uppercase mb-2">ວັນທີ</label>
                              <input 
                                type="date" 
                                value={medFormDate}
                                onChange={(e) => setMedFormDate(e.target.value)}
                                required 
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50" 
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-white/40 uppercase mb-2">ລຳດັບ</label>
                              <input 
                                type="number" 
                                value={medFormOrderNo}
                                onChange={(e) => setMedFormOrderNo(e.target.value)}
                                required 
                                min="1"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50" 
                              />
                            </div>
                          </div>
                          
                          <div>
                            <label className="block text-[10px] font-bold text-white/40 uppercase mb-2">ລາຍການ / ຊື່ຢາ</label>
                            <input 
                              type="text"
                              value={medFormName}
                              onChange={(e) => setMedFormName(e.target.value)}
                              placeholder="ຊື່ຢາ..."
                              required 
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50" 
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-white/40 uppercase mb-2">ໝາຍເຫດ</label>
                            <input 
                              type="text"
                              value={medFormNote}
                              onChange={(e) => setMedFormNote(e.target.value)}
                              placeholder="ລະບຸໝາຍເຫດ (ຖ້າມີ)..."
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50" 
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-bold text-white/40 uppercase mb-2">ຕົ້ນທຶນ</label>
                              <input 
                                type="number"
                                value={medFormCost}
                                onChange={(e) => setMedFormCost(e.target.value)}
                                placeholder="0"
                                required 
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50" 
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-white/40 uppercase mb-2">ລາຄາຂາຍ</label>
                              <input 
                                type="number"
                                value={medFormSellingPrice}
                                onChange={(e) => setMedFormSellingPrice(e.target.value)}
                                placeholder="0"
                                required 
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50" 
                              />
                            </div>
                          </div>
                          
                          <Button type="submit" className="w-full py-4 text-sm font-bold bg-indigo-500 hover:bg-[#2e266f] text-white shadow-lg shadow-indigo-500/10">
                            ເພີ່ມລາຍການ
                          </Button>
                        </form>
                      </Card>

                      {/* Summary calculations card */}
                      <Card className="border-white/5 bg-[#1c1c2e] p-6 shadow-xl space-y-4">
                        <h3 className="text-sm font-black uppercase tracking-wider text-white/40 mb-2">ສະຫຼຸບຍອດລວມ (ເດືອນທີ່ເລືອກ)</h3>
                        
                        <div className="space-y-4">
                          <div className="flex justify-between items-center bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                            <span className="text-xs font-bold text-white/60">ຕົ້ນທຶນລວມ</span>
                            <span className="text-lg font-black text-white text-right">
                              {filteredMedicineEntries.reduce((sum, item) => sum + item.cost, 0).toLocaleString()} <span className="text-xs font-bold text-white/40">ກີບ</span>
                            </span>
                          </div>
                          
                          <div className="flex justify-between items-center bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                            <span className="text-xs font-bold text-white/60">ລາຄາຂາຍລວມ</span>
                            <span className="text-lg font-black text-white text-right">
                              {filteredMedicineEntries.reduce((sum, item) => sum + item.sellingPrice, 0).toLocaleString()} <span className="text-xs font-bold text-white/40">ກີບ</span>
                            </span>
                          </div>

                          <div className="flex justify-between items-center bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-4">
                            <span className="text-xs font-bold text-indigo-400">ກຳໄລ (40%)</span>
                            <span className="text-lg font-black text-indigo-400 text-right">
                              {((filteredMedicineEntries.reduce((sum, item) => sum + item.sellingPrice, 0) - filteredMedicineEntries.reduce((sum, item) => sum + item.cost, 0)) * 0.4).toLocaleString()} <span className="text-xs font-bold">ກີບ</span>
                            </span>
                          </div>

                          <div className="flex justify-between items-center bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4">
                            <span className="text-xs font-bold text-rose-400">ລວມລູກໜີ້ຄົງເຫຼືອ</span>
                            <span className="text-xl font-black text-rose-400 text-right">
                              {filteredMedicineEntries
                                .filter(item => !item.isPaid)
                                .reduce((sum, item) => sum + (item.cost + (item.sellingPrice - item.cost) * 0.4), 0)
                                .toLocaleString()} <span className="text-xs font-bold">ກີບ</span>
                            </span>
                          </div>
                        </div>
                      </Card>
                    </div>

                    {/* Right Column: Share Table list */}
                    <div className="lg:col-span-2 space-y-6">
                      <Card className="border-white/5 bg-[#1c1c2e] p-6 shadow-xl">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-indigo-400">
                          <History className="w-5 h-5" />
                          ຕາຕະລາງຄິດໄລ່ສ່ວນແບ່ງ
                        </h3>
                        <p className="text-xs text-white/40 font-medium mb-6 font-mono">
                          ຂໍ້ມູນສຳລັບເດືອນ: {selectedMedicineMonth}
                        </p>

                        <div className="space-y-4">
                          {groupedMedicineByDate.length === 0 ? (
                            <div className="text-center py-12 text-white/20 text-sm font-bold">
                              ບໍ່ມີຂໍ້ມູນລູກໜີ້ຄ່າຢາໃນເດືອນນີ້
                            </div>
                          ) : (
                            groupedMedicineByDate.map((dateGroup) => {
                              const isDateExpanded = expandedMedicineDates[dateGroup.date] !== false;
                              
                              return (
                                <div key={dateGroup.date} className="space-y-3">
                                  {/* Date Group Header Row */}
                                  <div 
                                    onClick={() => toggleMedicineDate(dateGroup.date)}
                                    className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl cursor-pointer transition-all"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Calendar className="w-5 h-5 text-indigo-400" />
                                      <span className="font-extrabold text-white text-base">ວັນທີ {dateGroup.date.split('-')[2] || dateGroup.date}</span>
                                      <span className="text-xs text-white/40 font-bold font-mono">({dateGroup.date})</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className={cn(
                                        "text-xs font-bold px-3 py-1 rounded-full font-mono transition-all",
                                        dateGroup.remainingAmount > 0 
                                          ? "bg-rose-500/10 border border-rose-500/20 text-rose-400" 
                                          : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                                      )}>
                                        ຄົງເຫຼືອ: {dateGroup.remainingAmount.toLocaleString()} ກີບ
                                      </span>
                                      <span className="text-xs font-bold bg-[#12121e] border border-white/10 px-3 py-1 rounded-full text-indigo-400 font-mono">
                                        {dateGroup.completedOrders} / {dateGroup.totalOrders} ລຳດັບ
                                      </span>
                                      {isDateExpanded ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
                                    </div>
                                  </div>

                                  {/* Order Lists inside expanded Date */}
                                  {isDateExpanded && (
                                    <div className="pl-4 pr-1 py-1 space-y-4 border-l border-white/5">
                                      {dateGroup.orders.map((order) => {
                                        const orderKey = `${dateGroup.date}_${order.orderNo}`;
                                        const isOrderExpanded = expandedMedicineOrders[orderKey] !== false;
                                        
                                        return (
                                          <div key={order.orderNo} className="bg-[#12121e]/60 border border-white/5 rounded-2xl p-4 space-y-4 shadow-md">
                                            {/* Order header row */}
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-3">
                                              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                                <span className="text-xs font-black text-rose-400 uppercase bg-rose-500/10 px-3 py-1 rounded-xl">
                                                  ລຳດັບ: {order.orderNo}
                                                </span>
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-white/60">
                                                  <span>ຈ່າຍ (ຄົງເຫຼືອ):</span>
                                                  <span className="text-indigo-400 font-extrabold">{order.totalPayRemaining.toLocaleString()} ກີບ</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-white/60">
                                                  <span>ກຳໄລ (40%):</span>
                                                  <span className="text-emerald-400 font-extrabold">{order.totalProfit40.toLocaleString()} ກີບ</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-white/60">
                                                  <span>ກຳໄລ (60%):</span>
                                                  <span className="text-rose-400 font-extrabold">{order.totalProfit60.toLocaleString()} ກີບ</span>
                                                </div>
                                              </div>

                                              <div className="flex items-center gap-4 self-end sm:self-auto">
                                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                                  <input 
                                                    type="checkbox"
                                                    checked={order.isPaid}
                                                    onChange={() => handleToggleOrderPaid(dateGroup.date, order.orderNo, order.isPaid)}
                                                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-0 cursor-pointer"
                                                  />
                                                  <span className={cn(
                                                    "text-xs font-black transition-colors",
                                                    order.isPaid ? "text-emerald-400" : "text-white/40"
                                                  )}>
                                                    ສຳເລັດ (Done)
                                                  </span>
                                                </label>

                                                <button 
                                                  onClick={() => toggleMedicineOrder(orderKey)}
                                                  className="p-1 hover:bg-white/5 rounded-lg transition-all text-white/40 hover:text-white"
                                                >
                                                  {isOrderExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </button>
                                              </div>
                                            </div>

                                            {/* Inner items table */}
                                            {isOrderExpanded && (
                                              <div className="overflow-x-auto scrollbar-hide">
                                                <table className="w-full text-xs text-left text-white/80 border-collapse">
                                                  <thead>
                                                    <tr className="border-b border-white/5 text-[10px] font-bold text-white/40 uppercase tracking-wider">
                                                      <th className="py-2 px-3">ລາຍການ</th>
                                                      <th className="py-2 px-3">ໝາຍເຫດ</th>
                                                      <th className="py-2 px-3 text-right">ຕົ້ນທຶນ</th>
                                                      <th className="py-2 px-3 text-right">ລາຄາຂາຍ</th>
                                                      <th className="py-2 px-3 text-right">ກຳໄລ</th>
                                                      <th className="py-2 px-3 text-right">40%</th>
                                                      <th className="py-2 px-3 text-right">60%</th>
                                                      <th className="py-2 px-3 text-center w-10"></th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {order.items.map((item) => {
                                                      const isEditing = editingMedicineId === item.id;
                                                      const itemProfit = isEditing
                                                        ? (Number(editingMedicineSellingPrice) || 0) - (Number(editingMedicineCost) || 0)
                                                        : item.sellingPrice - item.cost;
                                                      const itemProfit40 = itemProfit * 0.4;
                                                      const itemProfit60 = itemProfit * 0.6;

                                                      const handleKeyDown = (e: React.KeyboardEvent) => {
                                                        if (e.key === 'Enter') {
                                                          handleUpdateMedicineItem(
                                                            item.id,
                                                            Number(editingMedicineCost) || 0,
                                                            Number(editingMedicineSellingPrice) || 0,
                                                            editingMedicineName,
                                                            editingMedicineNote
                                                          );
                                                        } else if (e.key === 'Escape') {
                                                          setEditingMedicineId(null);
                                                        }
                                                      };

                                                      return (
                                                        <tr key={item.id} className="border-b border-white/[0.02] last:border-0 hover:bg-white/[0.01]">
                                                          {isEditing ? (
                                                            <>
                                                              <td className="py-2 px-1">
                                                                <input 
                                                                  type="text" 
                                                                  value={editingMedicineName}
                                                                  onChange={(e) => setEditingMedicineName(e.target.value)}
                                                                  onKeyDown={handleKeyDown}
                                                                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500/50 font-bold"
                                                                />
                                                              </td>
                                                              <td className="py-2 px-1">
                                                                <input 
                                                                  type="text" 
                                                                  value={editingMedicineNote}
                                                                  onChange={(e) => setEditingMedicineNote(e.target.value)}
                                                                  onKeyDown={handleKeyDown}
                                                                  placeholder="ໝາຍເຫດ"
                                                                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                                                                />
                                                              </td>
                                                              <td className="py-2 px-1 text-right">
                                                                <input 
                                                                  type="number" 
                                                                  value={editingMedicineCost}
                                                                  onChange={(e) => setEditingMedicineCost(e.target.value)}
                                                                  onKeyDown={handleKeyDown}
                                                                  className="w-24 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white text-right focus:outline-none focus:border-indigo-500/50 font-mono"
                                                                  placeholder="0"
                                                                />
                                                              </td>
                                                              <td className="py-2 px-1 text-right">
                                                                <input 
                                                                  type="number" 
                                                                  value={editingMedicineSellingPrice}
                                                                  onChange={(e) => setEditingMedicineSellingPrice(e.target.value)}
                                                                  onKeyDown={handleKeyDown}
                                                                  className="w-24 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white text-right focus:outline-none focus:border-indigo-500/50 font-mono"
                                                                  placeholder="0"
                                                                />
                                                              </td>
                                                            </>
                                                          ) : (
                                                            <>
                                                              <td className="py-2.5 px-3 font-bold text-white/90">{item.name}</td>
                                                              <td className="py-2.5 px-3 text-white/40 italic">{item.note || '-'}</td>
                                                              <td className="py-2.5 px-3 text-right font-mono">{item.cost.toLocaleString()}</td>
                                                              <td className="py-2.5 px-3 text-right font-mono">{item.sellingPrice.toLocaleString()}</td>
                                                            </>
                                                          )}
                                                          <td className="py-2.5 px-3 text-right font-mono text-emerald-400">{itemProfit.toLocaleString()}</td>
                                                          <td className="py-2.5 px-3 text-right font-mono text-indigo-400">{itemProfit40.toLocaleString()}</td>
                                                          <td className="py-2.5 px-3 text-right font-mono text-rose-400">{itemProfit60.toLocaleString()}</td>
                                                          <td className="py-2.5 px-3 text-center">
                                                            {isEditing ? (
                                                              <div className="flex items-center justify-center gap-1">
                                                                <button 
                                                                  onClick={() => handleUpdateMedicineItem(
                                                                    item.id,
                                                                    Number(editingMedicineCost) || 0,
                                                                    Number(editingMedicineSellingPrice) || 0,
                                                                    editingMedicineName,
                                                                    editingMedicineNote
                                                                  )}
                                                                  className="p-1 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-all text-emerald-400 animate-pulse"
                                                                  title="ບັນທຶກ"
                                                                >
                                                                  <Check className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button 
                                                                  onClick={() => setEditingMedicineId(null)}
                                                                  className="p-1 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-all text-white/40"
                                                                  title="ຍົກເລີກ"
                                                                >
                                                                  <X className="w-3.5 h-3.5" />
                                                                </button>
                                                              </div>
                                                            ) : (
                                                              <div className="flex items-center justify-center gap-1">
                                                                <button 
                                                                  onClick={() => {
                                                                    setEditingMedicineId(item.id);
                                                                    setEditingMedicineName(item.name);
                                                                    setEditingMedicineNote(item.note || '');
                                                                    setEditingMedicineCost(String(item.cost));
                                                                    setEditingMedicineSellingPrice(String(item.sellingPrice));
                                                                  }}
                                                                  className="p-1 hover:text-indigo-400 hover:bg-indigo-500/10 rounded transition-all text-white/20"
                                                                  title="ແກ້ໄຂ"
                                                                >
                                                                  <Edit className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button 
                                                                  onClick={() => handleDeleteMedicineItem(item.id)}
                                                                  className="p-1 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-all text-white/20"
                                                                  title="ລົບ"
                                                                >
                                                                  <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                              </div>
                                                            )}
                                                          </td>
                                                        </tr>
                                                      );
                                                    })}
                                                    
                                                    {/* Total Row */}
                                                    <tr className="bg-white/[0.02] border-t border-white/5 font-bold">
                                                      <td className="py-2 px-3 text-indigo-400">ລວມ</td>
                                                      <td className="py-2 px-3"></td>
                                                      <td className="py-2 px-3 text-right font-mono text-white">{order.totalCost.toLocaleString()}</td>
                                                      <td className="py-2 px-3 text-right font-mono text-white">{order.totalSellingPrice.toLocaleString()}</td>
                                                      <td className="py-2 px-3 text-right font-mono text-emerald-400">{order.totalProfit.toLocaleString()}</td>
                                                      <td className="py-2 px-3 text-right font-mono text-indigo-400">{order.totalProfit40.toLocaleString()}</td>
                                                      <td className="py-2 px-3 text-right font-mono text-rose-400">{order.totalProfit60.toLocaleString()}</td>
                                                      <td className="py-2 px-3"></td>
                                                    </tr>
                                                  </tbody>
                                                </table>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </Card>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-8 pb-10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black uppercase tracking-tighter">ລູກໜີ້ - ເຈົ້າໜີ້</h2>
                    <p className="text-xs font-bold text-white/40 uppercase tracking-widest">
                      {selectedDebtorMonth === 'all' ? 'ສຳລັບທັງໝົດ' : `ປະຈຳເດືອນ: ${selectedDebtorMonth}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Button 
                      onClick={() => {
                        setActiveTab('medicine_debtors');
                        setDebtorsSubTab('medicine');
                      }}
                      className="flex items-center justify-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-4 py-2.5 rounded-xl text-xs font-bold shrink-0 transition-all shadow-md"
                    >
                      <Users className="w-4 h-4 text-indigo-400 font-bold" />
                      <span>ລູກໜີ້ຄ່າຢາ</span>
                    </Button>
                    
                    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-fit">
                      <Calendar className="w-4 h-4 text-indigo-400" />
                      <select 
                        value={selectedDebtorMonth}
                        onChange={(e) => setSelectedDebtorMonth(e.target.value)}
                        className="bg-transparent text-sm font-bold focus:outline-none cursor-pointer text-white"
                      >
                        <option value="all" className="bg-[#1c1c2e] text-white">ທັງໝົດ (All)</option>
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => {
                          const d = new Date();
                          d.setDate(1);
                          d.setMonth(d.getMonth() - i);
                          const val = d.toISOString().slice(0, 7);
                          return <option key={val} value={val} className="bg-[#1c1c2e] text-white">{val}</option>
                        })}
                      </select>
                    </div>
                  </div>
                </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card className="bg-emerald-500/10 border-emerald-500/20 p-6 shadow-xl relative overflow-hidden group">
                  <div className="absolute top-4 right-4 opacity-20 group-hover:opacity-40 transition-all">
                    <TrendingUp className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div className="text-xs font-bold text-emerald-400/60 uppercase mb-2">ລວມລູກໜີ້ (Debtors)</div>
                  <div className="text-3xl font-black text-emerald-400">
                    {filteredDebtorEntries.filter(e => e.type === 'debtor' && !e.isPaid).reduce((sum, e) => sum + e.amount, 0).toLocaleString()} <span className="text-sm">ກີບ</span>
                  </div>
                </Card>
                <Card className="bg-rose-500/10 border-rose-500/20 p-6 shadow-xl relative overflow-hidden group">
                  <div className="absolute top-4 right-4 opacity-20 group-hover:opacity-40 transition-all">
                    <TrendingDown className="w-8 h-8 text-rose-400" />
                  </div>
                  <div className="text-xs font-bold text-rose-400/60 uppercase mb-2">ລວມເຈົ້າໜີ້ (Creditors)</div>
                  <div className="text-3xl font-black text-rose-400">
                    {filteredDebtorEntries.filter(e => e.type === 'creditor' && !e.isPaid).reduce((sum, e) => sum + e.amount, 0).toLocaleString()} <span className="text-sm">ກີບ</span>
                  </div>
                </Card>
                <Card className="bg-indigo-500/10 border-indigo-500/20 p-6 shadow-xl relative overflow-hidden group">
                  <div className="absolute top-4 right-4 opacity-20 group-hover:opacity-40 transition-all">
                    <PiggyBank className="w-8 h-8 text-indigo-400" />
                  </div>
                  <div className="text-xs font-bold text-indigo-400/60 uppercase mb-2">ຄົງເຫຼືອ (Balance)</div>
                  <div className="text-3xl font-black text-indigo-400">
                    {(filteredDebtorEntries.filter(e => e.type === 'debtor' && !e.isPaid).reduce((sum, e) => sum + e.amount, 0) - 
                      filteredDebtorEntries.filter(e => e.type === 'creditor' && !e.isPaid).reduce((sum, e) => sum + e.amount, 0)).toLocaleString()} <span className="text-sm">ກີບ</span>
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-1 border-white/5 bg-[#1c1c2e] p-6">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-indigo-400" />
                    ເພີ່ມລາຍການໃໝ່
                  </h3>
                  <form onSubmit={handleAddDebtor} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-white/40 uppercase mb-2">ປະເພດ</label>
                      <select name="type" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50 cursor-pointer">
                        <option value="debtor" className="bg-[#1c1c2e]">ລູກໜີ້ (ພວກເຂົາຕິດໜີ້ເຮົາ)</option>
                        <option value="creditor" className="bg-[#1c1c2e]">ເຈົ້າໜີ້ (ເຮົາຕິດໜີ້ພວກເຂົາ)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-white/40 uppercase mb-2">ລາຍລະອຽດ / ຊື່</label>
                      <textarea name="description" rows={3} required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50 resize-none" placeholder="ລະບຸລາຍລະອຽດ..."></textarea>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-white/40 uppercase mb-2">ຈຳນວນເງິນ</label>
                      <input name="amount" type="number" required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50" placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-white/40 uppercase mb-2">ວັນທີ</label>
                      <input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50" />
                    </div>
                    <Button type="submit" className="w-full py-4 text-sm font-bold shadow-lg shadow-indigo-500/10">ເພີ່ມລາຍການ</Button>
                  </form>
                </Card>

                <div className="lg:col-span-2 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                       <History className="w-5 h-5 text-indigo-400" />
                       ລາຍການທັງໝົດ ({filteredDebtorEntries.length})
                    </h3>
                  </div>
                  <div className="space-y-4">
                    {filteredDebtorEntries.map(entry => (
                      <Card key={entry.id} className={cn(
                        "p-4 border-white/5 transition-all hover:bg-white/[0.02]",
                        entry.isPaid ? "opacity-50 grayscale bg-white/[0.01]" : "bg-[#161623]/40"
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-12 h-12 rounded-2xl flex items-center justify-center",
                              entry.type === 'debtor' ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                            )}>
                              {entry.type === 'debtor' ? <Users className="w-6 h-6" /> : <UserPlus className="w-6 h-6" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-white/90">{entry.description}</span>
                                <span className={cn(
                                  "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                                  entry.type === 'debtor' ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                                )}>
                                  {entry.type === 'debtor' ? 'ລູກໜີ້' : 'ເຈົ້າໜີ້'}
                                </span>
                                {entry.isPaid && (
                                  <span className="bg-white/10 text-white/40 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest">ຊຳລະແລ້ວ</span>
                                )}
                              </div>
                              <div className="text-[10px] text-white/30 uppercase tracking-widest font-bold">
                                {entry.date}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <div className={cn(
                                "text-xl font-black tracking-tight",
                                entry.type === 'debtor' ? "text-emerald-400" : "text-rose-400"
                              )}>
                                {entry.amount.toLocaleString()} <span className="text-[10px] uppercase font-bold opacity-50">ກີບ</span>
                              </div>
                              <div className="text-[9px] font-bold text-white/20 uppercase tracking-widest">{entry.id}</div>
                            </div>
                            
                            <div className="flex gap-2">
                              <button 
                                onClick={() => setEditingDebtorId(entry.id)}
                                className="w-10 h-10 flex items-center justify-center bg-white/5 text-white/40 rounded-xl hover:bg-white/10 hover:text-white transition-all active:scale-90"
                                title="ແກ້ໄຂ"
                              >
                                <Edit className="w-5 h-5" />
                              </button>
                              {!entry.isPaid ? (
                                <button 
                                  onClick={() => handleUpdateDebtorStatus(entry.id, true)}
                                  className="w-10 h-10 flex items-center justify-center bg-emerald-500/10 text-emerald-400 rounded-xl hover:bg-emerald-500/20 transition-all active:scale-90"
                                  title="ໝາຍວ່າຊຳລະແລ້ວ"
                                >
                                  <CheckCircle2 className="w-5 h-5" />
                                </button>
                              ) : (
                                <button 
                                  onClick={() => handleUpdateDebtorStatus(entry.id, false)}
                                  className="w-10 h-10 flex items-center justify-center bg-amber-500/10 text-amber-500 rounded-xl hover:bg-amber-500/20 transition-all active:scale-90"
                                  title="ກັບຄືນເປັນຍັງຄ້າງ"
                                >
                                  <RefreshCcw className="w-5 h-5" />
                                </button>
                              )}
                              <button 
                                onClick={() => handleDeleteDebtor(entry.id)}
                                className="w-10 h-10 flex items-center justify-center bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500/20 transition-all active:scale-90"
                                title="ລົບ"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                    {filteredDebtorEntries.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-20 bg-white/[0.02] border border-dashed border-white/5 rounded-3xl opacity-30">
                        <Users className="w-12 h-12 mb-4" />
                        <p className="text-sm font-bold uppercase tracking-widest">ບໍ່ມີຂໍ້ມູນລູກໜີ້-ເຈົ້າໜີ້</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

          {/* Edit Debtor Modal */}
          <AnimatePresence>
            {editingTransactionId && (
              <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }}
                  onClick={() => setEditingTransactionId(null)}
                  className="absolute inset-0 bg-black/80 backdrop-blur-md"
                />
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  className="relative w-full max-w-lg bg-[#161623] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
                >
                  <form onSubmit={handleUpdateTransaction}>
                    <div className="p-8">
                      <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-bold">ແກ້ໄຂທຸລະກຳ</h2>
                        <button type="button" onClick={() => setEditingTransactionId(null)} className="p-2 hover:bg-white/5 rounded-full">
                          <X className="w-6 h-6" />
                        </button>
                      </div>

                      {(() => {
                        const tx = transactions.find(t => t.id === editingTransactionId);
                        if (!tx) return null;
                        return (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] font-bold text-white/40 uppercase mb-2">ປະເພດ</label>
                                <select 
                                  name="type" 
                                  defaultValue={tx.type}
                                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50"
                                >
                                  <option value="income" className="bg-[#1c1c2e]">ຮັບ (Income)</option>
                                  <option value="expense" className="bg-[#1c1c2e]">ຈ່າຍ (Expense)</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-white/40 uppercase mb-2">ທຸລະກິດ</label>
                                <select 
                                  name="businessType" 
                                  defaultValue={tx.businessType}
                                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50"
                                >
                                  {BUSINESS_TYPES.map(b => (
                                    <option key={b.id} value={b.id} className="bg-[#1c1c2e]">{b.name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] font-bold text-white/40 uppercase mb-2">ວັນທີ</label>
                                <input 
                                  name="date" 
                                  type="date" 
                                  defaultValue={tx.date}
                                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-white/40 uppercase mb-2">ໝວດໝູ່</label>
                                <select 
                                  name="category" 
                                  defaultValue={tx.category}
                                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50"
                                >
                                  {ACCOUNTING_CATEGORIES.map(c => (
                                    <option key={c} value={c} className="bg-[#1c1c2e]">{c}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-white/40 uppercase mb-2">ຈຳນວນເງິນ</label>
                              <input 
                                name="amount" 
                                type="number" 
                                defaultValue={tx.amount}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-black text-indigo-400 focus:outline-none focus:border-indigo-500/50"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-white/40 uppercase mb-2">ຄຳອະທິບາຍ</label>
                              <textarea 
                                name="description" 
                                rows={2} 
                                defaultValue={tx.note}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50 resize-none"
                              ></textarea>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="p-8 bg-white/[0.02] border-t border-white/5 flex gap-4">
                      <Button type="button" variant="secondary" onClick={() => setEditingTransactionId(null)} className="flex-1">ຍົກເລີກ</Button>
                      <Button type="submit" className="flex-1">ບັນທຶກ</Button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Edit Debtor Modal */}
          {editingDebtorId && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEditingDebtorId(null)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="relative w-full max-w-md bg-[#1c1c2e] border border-white/10 rounded-3xl p-6 shadow-2xl"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                    <Edit className="w-5 h-5 text-indigo-400" />
                    ແກ້ໄຂລາຍການ
                  </h3>
                  <button 
                    onClick={() => setEditingDebtorId(null)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/5 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {(() => {
                  const entry = debtorEntries.find(e => e.id === editingDebtorId);
                  if (!entry) return null;
                  return (
                    <form onSubmit={handleUpdateDebtor} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-white/40 uppercase mb-2">ປະເພດ</label>
                        <select 
                          name="type" 
                          defaultValue={entry.type}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                        >
                          <option value="debtor" className="bg-[#1c1c2e]">ລູກໜີ້ (ພວກເຂົາຕິດໜີ້ເຮົາ)</option>
                          <option value="creditor" className="bg-[#1c1c2e]">ເຈົ້າໜີ້ (ເຮົາຕິດໜີ້ພວກເຂົາ)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-white/40 uppercase mb-2">ລາຍລະອຽດ / ຊື່</label>
                        <textarea 
                          name="description" 
                          rows={3} 
                          required 
                          defaultValue={entry.description}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50 resize-none" 
                          placeholder="ລະບຸລາຍລະອຽດ..."
                        ></textarea>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-white/40 uppercase mb-2">ຈຳນວນເງິນ</label>
                        <input 
                          name="amount" 
                          type="number" 
                          required 
                          defaultValue={entry.amount}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50" 
                          placeholder="0" 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-white/40 uppercase mb-2">ວັນທີ</label>
                        <input 
                          name="date" 
                          type="date" 
                          defaultValue={entry.date}
                          required 
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50" 
                        />
                      </div>
                      <div className="flex gap-4 pt-4">
                        <Button 
                          type="button" 
                          variant="secondary"
                          onClick={() => setEditingDebtorId(null)}
                          className="flex-1 py-4 text-sm font-bold"
                        >
                          ຍົກເລີກ
                        </Button>
                        <Button 
                          type="submit" 
                          className="flex-1 py-4 text-sm font-bold shadow-lg shadow-indigo-500/10"
                        >
                          ບັນທຶກການແກ້ໄຂ
                        </Button>
                      </div>
                    </form>
                  );
                })()}
              </motion.div>
            </div>
          )}

      {/* Modals */}

      {/* Daily Bills Detail Modal */}
      <AnimatePresence>
        {selectedReportDay && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setSelectedReportDay(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl bg-[#161623] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">ລາຍລະອຽດບິນປະຈຳວັນ</h2>
                  <p className="text-white/40 text-xs font-mono">{selectedReportDay}</p>
                </div>
                <button 
                  onClick={() => setSelectedReportDay(null)}
                  className="p-2 hover:bg-white/5 rounded-full"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {sales.filter(s => new Date(s.timestamp).toISOString().split('T')[0] === selectedReportDay).map(sale => {
                    const saleCost = sale.items.reduce((sum, item) => sum + ((item.cost || 0) * item.quantity), 0);
                    const saleProfit = sale.total - saleCost;
                    return (
                      <div key={sale.id} className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-4 group relative">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">{sale.id}</div>
                            <div className="text-xs text-white/40">{new Date(sale.timestamp).toLocaleTimeString('lo-LA')}</div>
                          </div>
                          <div className="flex items-center gap-2">
                             <button 
                              onClick={() => handleDeleteSale(sale)}
                              className="p-2 text-rose-500/50 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                              title="ລົບໃບບິນ"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                            <div className="text-right">
                              <div className="text-xl font-black text-white">{sale.total.toLocaleString()} ₭</div>
                              <div className="text-[11px] font-semibold text-emerald-400 mt-1 flex items-center justify-end gap-1 font-sans">
                                <span>ກຳໄລ:</span>
                                <span>{saleProfit.toLocaleString()} ₭</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2 border-t border-white/5 pt-4">
                          {sale.items.map(item => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span className="text-white/60">
                                {item.name} 
                                {item.size && <span className="text-[10px] text-white/40 ml-1">({item.size})</span>}
                                {` x ${item.quantity}`}
                              </span>
                              <span className="font-bold">{(item.price * item.quantity).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between items-center pt-2 text-[10px] font-bold uppercase text-white/20">
                          <span>ວິທີຊຳລະ: {sale.paymentMethod}</span>
                          <div className="flex items-center gap-3">
                            {sale.discount > 0 && <span className="text-rose-500/80">ສ່ວນຫຼຸດ: {sale.discount.toLocaleString()}</span>}
                            <button 
                              onClick={() => setReceipt(sale)}
                              className="text-indigo-400 hover:text-indigo-300 font-black tracking-widest"
                            >
                              ເບິ່ງບິນ
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {sales.filter(s => new Date(s.timestamp).toISOString().split('T')[0] === selectedReportDay).length === 0 && (
                    <div className="col-span-full py-20 text-center text-white/20 italic">
                      ບໍ່ມີຂໍ້ມູນບິນຕົວຈິງໃນມື້ນີ້ (ຂໍ້ມູນໃນຕາຕະລາງແມ່ນການຈຳລອງ)
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 bg-white/[0.02] border-t border-white/5 flex justify-end">
                <Button variant="secondary" onClick={() => setSelectedReportDay(null)}>ປິດ</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      


      {/* Product Modal */}
        <AnimatePresence>
          {isProductModalOpen && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                onClick={() => setIsProductModalOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-w-lg bg-[#161623] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
              >
                <form onSubmit={handleSaveProduct}>
                  <div className="p-8">
                    <div className="flex items-center justify-between mb-8">
                      <h2 className="text-2xl font-bold">
                        {editingProduct ? 'ແກ້ໄຂສິນຄ້າ' : 'ເພີ່ມສິນຄ້າໃໝ່'}
                      </h2>
                      <button 
                        type="button"
                        onClick={() => setIsProductModalOpen(false)} 
                        className="p-2 hover:bg-white/5 rounded-full"
                      >
                        <X className="w-6 h-6" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Image Upload Area with Camera Support */}
                      <div className="flex flex-col items-center gap-4 mb-6 w-full">
                        {isCameraActive ? (
                          <div className="flex flex-col items-center gap-3 w-full">
                            <div className="relative w-full max-w-sm h-64 bg-black rounded-2xl overflow-hidden border border-white/10 shadow-inner flex items-center justify-center">
                              <video 
                                ref={videoRef} 
                                autoPlay 
                                playsInline 
                                className="w-full h-full object-cover"
                              />
                              {cameraError && (
                                <div className="absolute inset-0 bg-red-950/95 flex flex-col items-center justify-center p-4 text-center">
                                  <AlertCircle className="w-8 h-8 text-rose-500 mb-2 animate-bounce" />
                                  <span className="text-xs font-bold text-rose-400">{cameraError}</span>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex gap-2 w-full max-w-sm">
                              {!cameraError && (
                                <Button 
                                  type="button"
                                  onClick={handleCapturePhoto}
                                  className="flex-1 flex items-center justify-center gap-2 text-xs py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl"
                                >
                                  <Camera className="w-4 h-4" />
                                  ກົດຖ່າຍຮູບ
                                </Button>
                              )}
                              <Button 
                                type="button"
                                variant="secondary"
                                onClick={handleStopCamera}
                                className="flex-1 py-2.5 text-xs rounded-xl"
                              >
                                ປິດກ້ອງ
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-4">
                            <div 
                              onClick={() => fileInputRef.current?.click()}
                              className="relative w-32 h-32 bg-white/5 border-2 border-dashed border-white/10 rounded-2xl overflow-hidden cursor-pointer group hover:border-indigo-500/50 transition-all"
                            >
                              {uploadedImage ? (
                                <img src={uploadedImage} alt="Preview" className="w-full h-full object-cover" />
                              ) : (
                                <div className="flex flex-col items-center justify-center h-full text-white/20 group-hover:text-white/40">
                                  <ImageIcon className="w-8 h-8 mb-2" />
                                  <span className="text-[10px] font-bold uppercase tracking-wider">ເລືອກຮູບ</span>
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Upload className="w-6 h-6 text-white" />
                              </div>
                            </div>
                            
                            <div className="flex gap-2">
                              <Button 
                                type="button"
                                variant="secondary"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-1 text-[11px] font-bold px-3 py-1.5"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                ອັບໂຫຼດຮູບ
                              </Button>
                              <Button 
                                type="button"
                                variant="secondary"
                                onClick={handleStartCamera}
                                className="flex items-center gap-1 text-[11px] font-bold px-3 py-1.5"
                              >
                                <Camera className="w-3.5 h-3.5" />
                                ຖ່າຍຮູບດ້ວຍກ້ອງ
                              </Button>
                              {uploadedImage && (
                                <Button 
                                  type="button"
                                  onClick={() => setUploadedImage(null)}
                                  className="text-[11px] font-bold px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500/20"
                                >
                                  ລົບຮູບອອກ
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                        <input 
                          type="file" 
                          ref={fileInputRef}
                          onChange={handleImageUpload}
                          accept="image/*"
                          className="hidden" 
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="block text-xs font-bold text-white/40 uppercase mb-2">ຊື່ສິນຄ້າ</label>
                          <input 
                            name="name"
                            type="text" 
                            required
                            defaultValue={editingProduct?.name}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50"
                            placeholder="ລະບຸຊື່ສິນຄ້າ..."
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-white/40 uppercase mb-2">ໝວດໝູ່</label>
                          <select 
                            name="category"
                            defaultValue={editingProduct?.category || categories[1]}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50"
                          >
                            {categories.filter(c => c !== 'ທັງໝົດ').map(cat => (
                              <option key={cat} value={cat} className="bg-[#161623]">{cat}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-white/40 uppercase mb-2">ຈຳນວນໃນສາງ</label>
                          <input 
                            name="stock"
                            type="number" 
                            min="0"
                            defaultValue={editingProduct?.stock ?? 0}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50"
                            placeholder="0"
                          />
                        </div>
                      </div>

                      {currentShop === 'sports' ? (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-white/40 uppercase mb-2">ຕົ້ນທຶນ (ກີບ)</label>
                              <input 
                                name="cost"
                                type="number" 
                                defaultValue={editingProduct?.cost}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50"
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-white/40 uppercase mb-2">ຂະໜາດໄຊ້ (Size)</label>
                              <input 
                                name="size"
                                type="text" 
                                defaultValue={editingProduct?.size}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50"
                                placeholder="S, M, L, XL"
                              />
                            </div>
                          </div>

                          <div className="w-full">
                            <label className="block text-xs font-bold text-white/40 uppercase mb-2">ລາຄາຂາຍ (ກີບ)</label>
                            <input 
                              name="price"
                              type="number" 
                              required
                              defaultValue={editingProduct?.price}
                              className="w-full bg-indigo-500/5 border border-indigo-500/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50 text-indigo-400 font-bold"
                              placeholder="0"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-white/40 uppercase mb-2">ຕົ້ນທຶນ (ກີບ)</label>
                              <input 
                                name="cost"
                                type="number" 
                                defaultValue={editingProduct?.cost}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50"
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-white/40 uppercase mb-2">ຕົ້ນທຶນ (ບາດ)</label>
                              <input 
                                name="costTHB"
                                type="number" 
                                defaultValue={editingProduct?.costTHB}
                                className="w-full bg-amber-500/5 border border-amber-500/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50 text-amber-500"
                                placeholder="0"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-white/40 uppercase mb-2">ລາຄາຂາຍຍ່ອຍ</label>
                              <input 
                                name="price"
                                type="number" 
                                required
                                defaultValue={editingProduct?.price}
                                className="w-full bg-indigo-500/5 border border-indigo-500/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50 text-indigo-400 font-bold"
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-white/40 uppercase mb-2">ລາຄາຂາຍສົ່ງ</label>
                              <input 
                                name="wholesalePrice"
                                type="number" 
                                defaultValue={editingProduct?.wholesalePrice}
                                className="w-full bg-emerald-500/5 border border-emerald-500/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/50 text-emerald-400 font-bold"
                                placeholder="0"
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="p-8 bg-white/[0.02] border-t border-white/5 flex gap-4">
                    <Button 
                      type="button"
                      variant="secondary" 
                      className="flex-1 py-4" 
                      onClick={() => setIsProductModalOpen(false)}
                    >
                      ຍົກເລີກ
                    </Button>
                    <Button type="submit" className="flex-1 py-4 flex items-center justify-center gap-3">
                      <Save className="w-5 h-5" />
                      {editingProduct ? 'ບັນທຶກການແກ້ໄຂ' : 'ເພີ່ມສິນຄ້າ'}
                    </Button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Add Transport Modal */}
        <AnimatePresence>
          {isTransportModalOpen && (
            <div className="fixed inset-0 bg-[#0b0b14]/90 backdrop-blur-sm flex items-center justify-center z-[300] p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-[#1a1a2e] border border-white/10 rounded-[32px] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl shadow-indigo-500/10"
              >
                <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                  <div>
                    <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3 text-white">
                      <div className="p-2 bg-indigo-500/20 rounded-xl">
                        <Truck className="w-6 h-6 text-indigo-400" />
                      </div>
                      ເພີ່ມລາຍການຂົນສົ່ງໃໝ່
                    </h2>
                    <p className="text-xs font-bold text-white/20 uppercase tracking-widest mt-1">ລະບຸລາຍລະອຽດການຂົນສົ່ງ ແລະ ສິນຄ້າ</p>
                  </div>
                  <button 
                    onClick={() => setIsTransportModalOpen(false)}
                    className="p-3 hover:bg-white/5 rounded-2xl transition-colors text-white/40 hover:text-white"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                  {/* Top Configuration */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-[10px] font-black text-white/30 uppercase tracking-widest mb-3">ວັນທີ</label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                        <input 
                          type="date"
                          value={transportModalData.date}
                          onChange={(e) => setTransportModalData(prev => ({ ...prev, date: e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold focus:outline-none focus:border-indigo-500/50 text-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-white/30 uppercase tracking-widest mb-3">ບໍລິສັດຂົນສົ່ງ</label>
                      <select 
                        value={transportModalData.type}
                        onChange={(e) => setTransportModalData(prev => ({ ...prev, type: e.target.value as any }))}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold focus:outline-none focus:border-indigo-500/50 cursor-pointer text-white"
                      >
                        <option value="ANS" className="bg-[#1c1c2e]">ANS</option>
                        <option value="HAL" className="bg-[#1c1c2e]">HAL</option>
                        <option value="MX" className="bg-[#1c1c2e]">MX</option>
                        <option value="COD" className="bg-[#1c1c2e]">COD</option>
                      </select>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-12 gap-4 px-4 text-[10px] font-black text-white/20 uppercase tracking-widest">
                      <div className="col-span-5">ລາຍລະອຽດ</div>
                      <div className="col-span-2 text-right">ຕົ້ນທຶນ</div>
                      <div className="col-span-2 text-center">ຈຳນວນ</div>
                      <div className="col-span-2 text-right">ຈຳນວນເງິນ</div>
                      <div className="col-span-1"></div>
                    </div>

                    <div className="space-y-3">
                      {transportModalData.items.map((item) => (
                        <motion.div 
                          key={item.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="grid grid-cols-12 gap-4 items-center bg-white/[0.02] border border-white/5 p-4 rounded-2xl group transition-all hover:bg-white/[0.04]"
                        >
                          <div className="col-span-5 flex items-center gap-3">
                            {(() => {
                              const selectedProduct = products.find(p => p.id === item.productId);
                              return selectedProduct?.image ? (
                                <div 
                                  className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-black/20 border border-white/10 cursor-pointer hover:scale-105 transition-transform"
                                  onClick={() => {
                                    if (selectedProduct.image) {
                                      const w = window.open();
                                      w?.document.write(`<img src="${selectedProduct.image}" style="max-width:100%; max-height:100vh; display:block; margin:auto;" />`);
                                    }
                                  }}
                                  title="ຄລິກເພື່ອເບິ່ງຮູບໃຫຍ່"
                                >
                                  <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className="w-12 h-12 rounded-xl shrink-0 bg-white/5 flex items-center justify-center text-white/10 border border-white/5">
                                  <ImageIcon className="w-5 h-5" />
                                </div>
                              );
                            })()}
                            <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                              <input 
                                type="text"
                                placeholder="ລາຍລະອຽດ..."
                                value={item.detail}
                                onChange={(e) => handleUpdateTransportLine(item.id, { detail: e.target.value })}
                                className="w-full bg-transparent border-none p-0 text-sm font-medium focus:ring-0 text-white font-bold truncate"
                              />
                              {products.length > 0 && (
                                <select 
                                  value={item.productId || ""}
                                  onChange={(e) => {
                                    const prodId = e.target.value;
                                    const prod = products.find(p => p.id === prodId);
                                    if (prod) {
                                      handleUpdateTransportLine(item.id, { 
                                        productId: prod.id,
                                        detail: prod.name,
                                        cost: prod.cost,
                                        amount: prod.price * (item.quantity || 1)
                                      });
                                    } else {
                                      handleUpdateTransportLine(item.id, {
                                        productId: '',
                                        detail: '',
                                        cost: 0,
                                        amount: 0
                                      });
                                    }
                                  }}
                                  className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-1 text-[11px] text-white/50 focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                                >
                                  <option value="" className="bg-[#1c1c2e] text-white/40">-- ດຶງຂໍ້ມູນສິນຄ້າຈາກສາງ --</option>
                                  {products.map(p => (
                                    <option key={p.id} value={p.id} className="bg-[#1c1c2e] text-white text-xs">
                                      {p.name} (ທຶນ: {p.cost.toLocaleString()}, ຂາຍ: {p.price.toLocaleString()})
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </div>
                          <div className="col-span-2 text-white">
                             <input 
                              type="number"
                              value={item.cost || ''}
                              onChange={(e) => handleUpdateTransportLine(item.id, { cost: Number(e.target.value) })}
                              className="w-full bg-transparent border-none p-0 text-right text-sm font-bold focus:ring-0 text-white/90"
                            />
                          </div>
                          <div className="col-span-2 text-white">
                            <input 
                              type="number"
                              value={item.quantity || ''}
                              onChange={(e) => {
                                const qty = Number(e.target.value);
                                const matchedProduct = products.find(p => p.name === item.detail);
                                const updates: any = { quantity: qty };
                                if (matchedProduct) {
                                  updates.amount = matchedProduct.price * qty;
                                }
                                handleUpdateTransportLine(item.id, updates);
                              }}
                              className="w-full bg-transparent border-none p-0 text-center text-sm font-bold focus:ring-0 text-white/90"
                            />
                          </div>
                          <div className="col-span-2">
                            <input 
                              type="number"
                              value={item.amount || ''}
                              onChange={(e) => handleUpdateTransportLine(item.id, { amount: Number(e.target.value) })}
                              className="w-full bg-transparent border-none p-0 text-right text-sm font-black text-indigo-400 focus:ring-0"
                            />
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <button 
                              onClick={() => handleRemoveTransportLine(item.id)}
                              disabled={transportModalData.items.length === 1}
                              className="p-2 text-white/20 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all disabled:opacity-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    <button 
                      onClick={handleAddTransportLine}
                      className="w-full py-4 border-2 border-dashed border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-white/40 hover:border-white/10 transition-all flex items-center justify-center gap-3"
                    >
                      <PlusCircle className="w-4 h-4" />
                      ເພີ່ມອີກແຖວ
                    </button>
                  </div>
                </div>

                <div className="p-8 border-t border-white/5 bg-white/[0.02] flex justify-end gap-4">
                  <button 
                    onClick={() => setIsTransportModalOpen(false)}
                    className="px-8 py-4 rounded-2xl text-sm font-bold text-white/40 hover:text-white transition-colors"
                  >
                    ຍົກເລີກ
                  </button>
                  <Button 
                    onClick={handleSaveTransportBatch}
                    className="px-12 py-4 rounded-2xl text-sm font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-500 shadow-xl shadow-indigo-500/20 active:scale-95 transition-all text-white"
                  >
                    ບັນທຶກ
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {isDeleteConfirmModalOpen && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                onClick={() => setIsDeleteConfirmModalOpen(false)}
                className="absolute inset-0 bg-black/85 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="relative w-full max-w-md bg-[#161623] border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden z-[130]"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center shrink-0">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white">ລຶບຂໍ້ມູນສາງທັງໝົດ?</h2>
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mt-0.5">
                      ຮ້ານ: {currentShop === 'agriculture' ? '🌱 ຮ້ານກະເສດ' : '⚽ ຮ້ານກິລາ'}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-white/60 leading-relaxed mb-8">
                  ການດຳເນີນການນີ້ຈະລຶບສິນຄ້າທັງໝົດໃນຮ້ານປັດຈຸບັນອອກຖາວອນ ແລະ ບໍ່ສາມາດກູ້ຄືນໄດ້. ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການສືບຕໍ່?
                </p>

                <div className="flex justify-end gap-3">
                  <button 
                    onClick={() => setIsDeleteConfirmModalOpen(false)}
                    className="px-6 py-3 rounded-xl text-xs font-bold text-white/50 hover:text-white hover:bg-white/5 transition-all"
                  >
                    ຍົກເລີກ
                  </button>
                  <Button 
                    variant="danger"
                    onClick={handleDeleteAllProducts}
                    className="px-8 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-rose-500"
                  >
                    ຢືນຢันລຶບທັງໝົດ
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Receipt Modal */}
        <AnimatePresence>
          {receipt && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setReceipt(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 40 }}
              className="relative w-full max-w-sm bg-white text-[#1a1a2e] rounded-[40px] p-8 shadow-2xl overflow-hidden"
            >
              {/* Decorative waves */}
              <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600" />
              
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tight">ຊຳລະເງິນສຳເລັດ</h2>
                <p className="text-sm text-black/40 font-medium">{new Date(receipt.timestamp).toLocaleString('lo-LA')}</p>
              </div>

              <div className="space-y-4 border-t border-b border-black/5 py-6 mb-6">
                {receipt.items.map(item => (
                  <div key={item.id} className="flex justify-between items-start text-sm">
                    <div className="max-w-[180px]">
                      <p className="font-bold leading-tight">
                        {item.name}
                        {item.size && <span className="text-[10px] text-black/50 ml-1">({item.size})</span>}
                      </p>
                      <p className="text-[10px] text-black/40">{item.quantity} x {item.price.toLocaleString()}</p>
                    </div>
                    <span className="font-black">{(item.price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2 mb-8">
                <div className="flex justify-between text-sm text-black/40 font-medium">
                  <span>ຍອດລວມ</span>
                  <span>{receipt.subtotal.toLocaleString()}</span>
                </div>
                {receipt.discount > 0 && (
                  <div className="flex justify-between text-sm text-rose-500 font-medium">
                    <span>ສ່ວນຫຼຸດ</span>
                    <span>-{receipt.discount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-black pt-2 text-indigo-600">
                  <span>ລວມທັງໝົດ</span>
                  <span>{receipt.total.toLocaleString()} ກີບ</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button className="w-full bg-[#1a1a2e] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-colors">
                  <Printer className="w-5 h-5" />
                  ພິມໃບບິນ
                </button>
                <button 
                  className="w-full py-4 text-black/40 font-bold hover:text-black transition-colors"
                  onClick={() => setReceipt(null)}
                >
                  ປິດໜ້າຕ່າງ
                </button>
              </div>

              {/* Tearing effect */}
              <div className="absolute bottom-0 left-0 w-full flex overflow-hidden">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} className="min-w-[20px] h-2 bg-[#0b0b14] rounded-t-full -mb-1" />
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
          </div>
        </>
      )}
    </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      ` }} />
    </div>
  );
}
