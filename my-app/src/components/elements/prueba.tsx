
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { RawClientData, DisplayClient, DAY_MAP, DAY_NAMES, User } from '../types';
import { Checkbox } from './common/Checkbox';
import { Card } from './common/Card';
import { DownloadIcon, UploadIcon, CloudIcon, FilterIcon, SaveIcon, DatabaseIcon, ChevronLeftIcon, ChevronRightIcon, UserAddIcon, RefreshIcon, SearchIcon, MapPinIcon, XCircleIcon } from './common/Icons';
import { Spinner } from './common/Spinner';
import { supabase } from '../supabaseClient';
import { AddClientModal } from './AddClientModal';
import { Toast } from './common/Toast';
import { SuccessModal } from './common/SuccessModal';

declare const XLSX: any;

interface Props {
    user: User;
}

// Definición de patrones de visita para el selector móvil
const VISIT_PATTERNS = [
    { id: 'L-J', label: 'Lunes - Jueves', days: ['lunes', 'jueves'] },
    { id: 'M-V', label: 'Martes - Viernes', days: ['martes', 'viernes'] },
    { id: 'X-S', label: 'Miércoles - Sábado', days: ['miercoles', 'sabado'] },
    { id: 'L', label: 'Solo Lunes', days: ['lunes'] },
    { id: 'M', label: 'Solo Martes', days: ['martes'] },
    { id: 'X', label: 'Solo Miércoles', days: ['miercoles'] },
    { id: 'J', label: 'Solo Jueves', days: ['jueves'] },
    { id: 'V', label: 'Solo Viernes', days: ['viernes'] },
    { id: 'S', label: 'Solo Sábado', days: ['sabado'] },
];

const ClientManagementScreen: React.FC<Props> = ({ user }) => {
    const [clients, setClients] = useState<DisplayClient[]>([]);
    const [selectedRoute, setSelectedRoute] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // States for Address Editing
    const [editingAddressClientId, setEditingAddressClientId] = useState<string | null>(null);
    const [availableAddresses, setAvailableAddresses] = useState<any[]>([]);
    const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    const isAdmin = user.role === 'ADMIN';

    // Helper para CORS disponible en todo el componente
    const fetchWithCors = useCallback(async (url: string, options: RequestInit) => {
        try {
            const res = await fetch(url, options);
            return res;
        } catch (error: any) {
            console.warn("Fallo en conexión directa, intentando vía proxy CORS...", error);
            const proxyUrl = "https://corsproxy.io/?" + encodeURIComponent(url);
            return await fetch(proxyUrl, options);
        }
    }, []);

    // Reset page when filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedRoute, searchTerm]);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
    };


    // --- Lógica de Procesamiento de Datos ---
    const processRawData = useCallback((data: RawClientData[]) => {
        const clientMap = new Map<string, DisplayClient>();

        // Mapa inverso para leer días en texto (ej: "Lunes" -> "lunes")
        const REVERSE_DAY_NAMES: { [key: string]: keyof DisplayClient['days'] } = Object.entries(DAY_NAMES).reduce((acc, [key, value]) => {
            acc[value.toLowerCase()] = key as keyof DisplayClient['days']; // "lunes": "lunes"
            acc[value] = key as keyof DisplayClient['days'];             // "Lunes": "lunes"
            return acc;
        }, {} as any);

        data.forEach(row => {
            const id = row['Cliente (Identificación)'] || row['RUC'] || row['ruc'] || row['code'] || row['Cliente'] || row['Nombre'] || row['Cliente (Nombre)'];
            if (!id) return;

            if (!clientMap.has(id)) {
                const nombre = row['Cliente (Nombre)'] || row['Nombre a Mostrar'] || row['name'] || row['Nombre'] || 'Sin Nombre';
                const telefono = row['Dirección (Teléfono)'] || row['Teléfono'] || row['contact'] || row['phone'] || '';
                const categoria = row['Categoria'] || row['Cliente (Comentario)'] || row['price_list_code_lookup'] || '';
                const ruta = row['Ruta'] || row['route_code'] || '';
                const isInactive = (row['Cliente (Estatus)'] && row['Cliente (Estatus)'] !== '1' && row['Cliente (Estatus)'] !== 'Activo') || !!row['INACTIVO'] || !!row['Inactivo'];
                const addressDesc = row['Dirección (Descripción)'] || row['address'] || '';

                clientMap.set(id, {
                    id,
                    ruc: row['Cliente (Identificación)'] || row['RUC'] || row['ruc'] || row['identity_'] || '',
                    nombre: nombre,
                    telefono: telefono,
                    categoria: categoria,
                    ruta: ruta,
                    addressDescription: addressDesc,
                    days: {
                        lunes: false,
                        martes: false,
                        miercoles: false,
                        jueves: false,
                        viernes: false,
                        sabado: false,
                    },
                    inactivo: isInactive,
                    originalData: row,
                });
            }

            const client = clientMap.get(id)!;

            if (row['Día'] !== undefined) {
                const val = row['Día'];
                if (typeof val === 'number' || !isNaN(Number(val))) {
                    const dayKey = DAY_MAP[Number(val)];
                    if (dayKey) client.days[dayKey] = true;
                }
                else if (typeof val === 'string') {
                    const dayKey = REVERSE_DAY_NAMES[val] || REVERSE_DAY_NAMES[val.trim()];
                    if (dayKey) client.days[dayKey] = true;
                }
            } else if (row['day']) {
                const dayKey = DAY_MAP[Number(row['day'])];
                if (dayKey) {
                    client.days[dayKey] = true;
                }
            }

            const dayColumns: { [key: string]: keyof DisplayClient['days'] } = {
                'L': 'lunes',
                'M': 'martes',
                'X': 'miercoles',
                'J': 'jueves',
                'V': 'viernes',
                'S': 'sabado'
            };

            Object.entries(dayColumns).forEach(([colName, dayKey]) => {
                if (row[colName]) {
                    client.days[dayKey] = true;
                }
            });

            if (row['INACTIVO'] || row['Inactivo']) {
                client.inactivo = true;
            }
        });

        return Array.from(clientMap.values());
    }, []);

    const loadDataIntoState = useCallback((data: RawClientData[]) => {
        const processed = processRawData(data);
        setClients(processed);
        setSelectedRoute('');
    }, [processRawData]);


    // --- Logic for Inline Address Editing ---
    const handleLoadAddresses = async (client: DisplayClient) => {
        if (editingAddressClientId === client.id) {
            setEditingAddressClientId(null);
            return;
        }

        setEditingAddressClientId(client.id);
        setIsLoadingAddresses(true);
        setAvailableAddresses([]);

        try {
            // 1. Try Local Supabase
            const { data: localAddresses, error } = await supabase
                .from('api_addresses')
                .select('*')
                .eq('customer_code', client.id); // Assuming ID is the Code

            if (localAddresses && localAddresses.length > 0) {
                setAvailableAddresses(localAddresses);
                setIsLoadingAddresses(false);
                return;
            }

            // 2. Try Live API (only if session exists or we can get one)
            let sid = sessionId;
            if (!sid) {
                const commonOptions: RequestInit = {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'omit'
                };
                const loginBody = JSON.stringify({
                    "action": "login",
                    "login": "7",
                    "password": "Aqua2026.",
                    "context": "grupoaqua"
                });
                const loginRes = await fetchWithCors('https://s31.mobilvendor.com/web-service', {
                    ...commonOptions,
                    body: loginBody
                });
                if (loginRes.ok) {
                    const d = await loginRes.json();
                    sid = d.session_id;
                    setSessionId(sid);
                }
            }

            if (sid) {
                const addressBody = JSON.stringify({
                    "session_id": sid,
                    "action": "get",
                    "schema": "customer_addresses",
                    "page": 1,
                    "limit": 50,
                    "filter": `customer_code = '${client.id}'`
                });
                const res = await fetchWithCors('https://s31.mobilvendor.com/web-service', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: addressBody
                });
                const addrData = await res.json();
                if (addrData.records) {
                    setAvailableAddresses(addrData.records);
                }
            }
        } catch (e) {
            console.error("Error loading addresses", e);
        } finally {
            setIsLoadingAddresses(false);
        }
    };

    const handleAddressChange = (client: DisplayClient, addressIdx: number) => {
        const selectedAddr = availableAddresses[addressIdx];
        if (!selectedAddr) return;

        const newDesc = selectedAddr.description || selectedAddr.address || selectedAddr.street1 || 'Sin descripción';

        setClients(prev => prev.map(c => {
            if (c.id === client.id) {
                return {
                    ...c,
                    addressDescription: newDesc,
                    telefono: selectedAddr.phone || c.telefono,
                    originalData: {
                        ...c.originalData,
                        'Dirección (Descripción)': newDesc,
                        'Dirección (Calle principal)': selectedAddr.main_street || selectedAddr.street1 || '',
                        'Dirección (Calle secundaria)': selectedAddr.secondary_street || '',
                        'Dirección (Referencia)': selectedAddr.reference || '',
                        'Dirección (Teléfono)': selectedAddr.phone || c.originalData['Dirección (Teléfono)'],
                        'Dirección': selectedAddr.code || c.originalData['Dirección'],
                        'Dirección (Nombre)': selectedAddr.code || c.originalData['Dirección (Nombre)'],
                    }
                };
            }
            return c;
        }));
        setEditingAddressClientId(null);
        showToast('Dirección actualizada.', 'success');
    };

    const handleAddNewClient = useCallback(async (newClientData: RawClientData) => {
        // 1. Inserción inmediata en BD
        setIsLoading(true);
        setLoadingMessage('Guardando cliente...');
        try {
            const cleanString = (val: any) => (val === undefined || val === null || val === '') ? null : String(val).trim();

            const payload = {
                'RUC': cleanString(newClientData['RUC']),
                'Nombre a Mostrar': newClientData['Nombre a Mostrar'],
                'Teléfono': newClientData['Teléfono'],
                'Categoria': newClientData['Categoria'],
                'Latitud geográfica': null,
                'Longitud geográfica': null,
                'ZONA': null,
                'Ruta': newClientData['Ruta'],
                'L': false, 'M': false, 'X': false, 'J': false, 'V': false, 'S': false,
                'INACTIVO': false,
                'Novedad': null
            };

            const { error } = await supabase.from('routes').upsert([payload], { onConflict: 'RUC' });
            if (error) throw error;

            // 2. Actualización Local (Refresh) - Poner al principio
            const processedList = processRawData([newClientData]);
            if (processedList.length > 0) {
                const newClient = processedList[0];
                setClients(prev => {
                    // Remover si ya existe y ponerlo primero
                    const filtered = prev.filter(c => c.id !== newClient.id);
                    return [newClient, ...filtered];
                });
                showToast(`Cliente "${newClient.nombre}" guardado exitosamente.`, 'success');
            }

        } catch (err: any) {
            console.error(err);
            showToast(`Error al guardar cliente: ${err.message}`, 'error');
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    }, [processRawData]);


    const handleLoadFromSupabase = useCallback(async () => {
        setIsLoading(true);
        setLoadingMessage('Cargando datos guardados...');
        try {
            let allData: any[] = [];
            let hasMore = true;
            let from = 0;
            const step = 999;

            while (hasMore) {
                const to = from + step;
                const { data, error, count } = await supabase
                    .from('routes')
                    .select('*', { count: 'exact' })
                    .range(from, to);

                if (error) throw error;

                if (data && data.length > 0) {
                    allData = [...allData, ...data];
                    from += (step + 1);
                    if (data.length <= step) {
                        if (data.length < (step + 1)) hasMore = false;
                    }
                } else {
                    hasMore = false;
                }
            }

            if (allData.length > 0) {
                console.log(`Total registros cargados de BD: ${allData.length}`);

                const customerCodes = allData.map(r => String(r['RUC']).trim()).filter(c => c);

                let addressMap = new Map();

                const chunkSize = 1000;
                for (let i = 0; i < customerCodes.length; i += chunkSize) {
                    const batch = customerCodes.slice(i, i + chunkSize);
                    const { data: addrData } = await supabase
                        .from('api_addresses')
                        .select('customer_code, address')
                        .in('customer_code', batch);

                    if (addrData) {
                        addrData.forEach((a: any) => {
                            addressMap.set(a.customer_code, a.address);
                        });
                    }
                }

                const mappedData: RawClientData[] = allData.map((row: any) => {
                    const ruc = String(row['RUC']).trim();
                    const addressDesc = addressMap.get(ruc) || '';

                    return {
                        'RUC': row['RUC'],
                        'Cliente (Identificación)': row['RUC'],
                        'Cliente (Nombre)': row['Nombre a Mostrar'],
                        'Nombre a Mostrar': row['Nombre a Mostrar'],
                        'Teléfono': row['Teléfono'],
                        'Categoria': row['Categoria'],
                        'Latitud geográfica': row['Latitud geográfica'],
                        'Longitud geográfica': row['Longitud geográfica'],
                        'ZONA': row['ZONA'],
                        'Ruta': row['Ruta'],
                        'L': row['L'],
                        'M': row['M'],
                        'X': row['X'],
                        'J': row['J'],
                        'V': row['V'],
                        'S': row['S'],
                        'INACTIVO': row['INACTIVO'],
                        'Novedad': row['Novedad'],
                        'Cliente (Estatus)': '1',
                        'Estatus': 'Activo',
                        'Dirección (Descripción)': addressDesc,
                        'address': addressDesc
                    };
                });

                const processed = processRawData(mappedData);
                setClients(processed);
                setSelectedRoute('');
                return processed;
            }
            return [];
        } catch (err: any) {
            console.error('Error loading from DB:', err);
            showToast(`Error al cargar de BD: ${err.message}`, 'error');
            return [];
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    }, [processRawData]);


    const handleSyncMasterCustomers = useCallback(async () => {
        try {
            const commonOptions: RequestInit = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'omit'
            };

            const loginBody = JSON.stringify({
                "action": "login",
                "login": "7",
                "password": "Aqua2026.",
                "context": "grupoaqua"
            });

            const loginRes = await fetchWithCors('https://s31.mobilvendor.com/web-service', {
                ...commonOptions,
                body: loginBody
            });

            if (!loginRes.ok) return;
            const loginData = await loginRes.json();
            const sid = loginData.session_id;
            if (!sid) return;
            setSessionId(sid);

            let page = 1;
            let hasMore = true;
            const BATCH_SIZE = 1000;

            console.log("Iniciando sincronización de catálogo maestro...");

            while (hasMore) {
                const customersBody = JSON.stringify({
                    "session_id": sid,
                    "action": "get",
                    "schema": "customers",
                    "page": page,
                    "limit": BATCH_SIZE
                });

                const res = await fetchWithCors('https://s31.mobilvendor.com/web-service', {
                    ...commonOptions,
                    body: customersBody
                });
                const data = await res.json();

                if (data.records && data.records.length > 0) {
                    const recordsToUpsert = data.records.map((r: any) => ({
                        code: String(r.code),
                        identity_: r.identity_ ? String(r.identity_) : null,
                        name: r.name ? String(r.name) : null,
                        company_name: r.company_name ? String(r.company_name) : null,
                        contact: r.contact ? String(r.contact) : null,
                        price_list_code_lookup: r.price_list_code_lookup ? String(r.price_list_code_lookup) : null,
                        user_code_lookup: r.user_code_lookup ? String(r.user_code_lookup) : null,
                        status: String(r.status),
                        email: r.email ? String(r.email) : null,
                        balance: r.balance || 0
                    }));

                    const uniqueRecords = Array.from(new Map(recordsToUpsert.map((item: any) => [item.code, item])).values());

                    const { error } = await supabase
                        .from('api_customers')
                        .upsert(uniqueRecords, { onConflict: 'code' });

                    if (error) console.error("Error upserting customers batch:", JSON.stringify(error, null, 2));

                    if (page >= (data.pages || 1)) hasMore = false;
                    page++;
                } else {
                    hasMore = false;
                }
            }
            console.log("Catálogo maestro sincronizado.");

            console.log("Iniciando sincronización de direcciones...");
            page = 1;
            hasMore = true;

            while (hasMore) {
                const addrBody = JSON.stringify({
                    "session_id": sid,
                    "action": "get",
                    "schema": "customer_addresses",
                    "page": 1,
                    "limit": BATCH_SIZE
                });

                const res = await fetchWithCors('https://s31.mobilvendor.com/web-service', {
                    ...commonOptions,
                    body: addrBody
                });
                const data = await res.json();

                if (data.records && data.records.length > 0) {
                    const addrsToUpsert = data.records.map((r: any) => ({
                        code: String(r.code),
                        customer_code: String(r.customer_code),
                        address: r.description ? String(r.description) : (r.address ? String(r.address) : (r.street1 ? String(r.street1) : null)),
                        main_street: r.main_street ? String(r.main_street) : (r.street1 ? String(r.street1) : null),
                        secondary_street: r.secondary_street ? String(r.secondary_street) : null,
                        reference: r.reference ? String(r.reference) : null,
                        phone: r.phone ? String(r.phone) : null
                    }));

                    const uniqueAddrs = Array.from(new Map(addrsToUpsert.map((item: any) => [item.code, item])).values());

                    const { error } = await supabase
                        .from('api_addresses')
                        .upsert(uniqueAddrs, { onConflict: 'code' });

                    if (error) console.error("Error upserting addresses batch:", JSON.stringify(error, null, 2));

                    if (page >= (data.pages || 1)) hasMore = false;
                    page++;
                } else {
                    hasMore = false;
                }
            }
            console.log("Direcciones sincronizadas.");

        } catch (e) {
            console.error("Error en sync master:", e);
        }
    }, [fetchWithCors]);


    useEffect(() => {
        const init = async () => {
            const loadedData = await handleLoadFromSupabase();
            // Only Admin triggers API sync on load
            if (isAdmin) {
                if (loadedData && loadedData.length > 0) {
                    handleApiSync(loadedData);
                }
                handleSyncMasterCustomers();
            }
        };
        init();
    }, [isAdmin]);

    useEffect(() => {
        const enrichAddresses = async () => {
            const clientsToEnrich = clients.filter(c => !c.addressDescription && !c.inactivo);
            if (clientsToEnrich.length === 0) return;

            const codes = clientsToEnrich.map(c => c.id);
            const codesToQuery = codes.slice(0, 200);

            if (codesToQuery.length === 0) return;

            const { data: addrData } = await supabase
                .from('api_addresses')
                .select('customer_code, address')
                .in('customer_code', codesToQuery);

            if (addrData && addrData.length > 0) {
                const addrMap = new Map(addrData.map((a: any) => [a.customer_code, a.address]));

                setClients(prevClients => {
                    let hasChanges = false;
                    const updated = prevClients.map(c => {
                        if (addrMap.has(c.id) && !c.addressDescription) {
                            hasChanges = true;
                            const newDescription = addrMap.get(c.id) as string;
                            return {
                                ...c,
                                addressDescription: newDescription,
                                originalData: {
                                    ...c.originalData,
                                    'Dirección (Descripción)': newDescription
                                }
                            };
                        }
                        return c;
                    });
                    return hasChanges ? updated : prevClients;
                });
            }
        };

        if (clients.length > 0) {
            const timer = setTimeout(() => enrichAddresses(), 1000);
            return () => clearTimeout(timer);
        }
    }, [clients.length, clients]);


    const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        setLoadingMessage('Procesando archivo Excel...');
        try {
            const data = await new Promise<ArrayBuffer>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target?.result as ArrayBuffer);
                reader.onerror = err => reject(err);
                reader.readAsArrayBuffer(file);
            });

            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData: RawClientData[] = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length > 0) {
                loadDataIntoState(jsonData);
            } else {
                alert('El archivo está vacío.');
            }
        } catch (err) {
            console.error(err);
            alert('Error al procesar el archivo Excel.');
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
            event.target.value = '';
        }
    }, [loadDataIntoState]);

    const handleDayChange = useCallback((clientId: string, day: keyof DisplayClient['days'], value: boolean) => {
        setClients(prevClients =>
            prevClients.map(client =>
                client.id === clientId ? { ...client, days: { ...client.days, [day]: value } } : client
            )
        );
    }, []);

    const handleStatusChange = useCallback((clientId: string, inactivo: boolean) => {
        setClients(prevClients =>
            prevClients.map(client => {
                if (client.id === clientId) {
                    const newDays = inactivo ? { lunes: false, martes: false, miercoles: false, jueves: false, viernes: false, sabado: false } : client.days;
                    const newRuta = inactivo ? '' : client.ruta;
                    return { ...client, inactivo, days: newDays, ruta: newRuta };
                }
                return client;
            })
        );
    }, []);

    const handlePatternChange = useCallback((clientId: string, patternId: string) => {
        if (patternId === 'inactivo') {
            handleStatusChange(clientId, true);
            return;
        }

        if (patternId === 'custom' || patternId === 'none') {
            if (patternId === 'none') {
                setClients(prev => prev.map(c => {
                    if (c.id === clientId) {
                        return { ...c, days: { lunes: false, martes: false, miercoles: false, jueves: false, viernes: false, sabado: false } };
                    }
                    return c;
                }));
            }
            return;
        }

        const pattern = VISIT_PATTERNS.find(p => p.id === patternId);
        if (pattern) {
            const newDays = {
                lunes: false, martes: false, miercoles: false, jueves: false, viernes: false, sabado: false
            };
            pattern.days.forEach(d => {
                // @ts-ignore
                newDays[d] = true;
            });

            setClients(prev => prev.map(c => {
                if (c.id === clientId) {
                    return { ...c, days: newDays, inactivo: false };
                }
                return c;
            }));
        }
    }, [handleStatusChange]);

    const getClientPattern = (client: DisplayClient) => {
        if (client.inactivo) return 'inactivo';

        const activeDays = Object.entries(client.days).filter(([_, v]) => v).map(([k]) => k);
        if (activeDays.length === 0) return 'none';

        const match = VISIT_PATTERNS.find(p => {
            return p.days.length === activeDays.length &&
                p.days.every(d => client.days[d as keyof typeof client.days]);
        });

        return match ? match.id : 'custom';
    };

    const allowedClients = useMemo(() => {
        if (user.role === 'ADMIN') return clients;
        const allowedRoutes = user.assigned_routes || [];
        return clients.filter(client => allowedRoutes.includes(client.ruta));
    }, [clients, user]);

    const uniqueRoutes = useMemo(() => {
        const routes = new Set(allowedClients.map(c => c.ruta).filter(r => r && r.trim() !== ''));
        return Array.from(routes).sort();
    }, [allowedClients]);

    const filteredClients = useMemo(() => {
        let result = allowedClients;
        if (selectedRoute) {
            result = result.filter(client => client.ruta === selectedRoute);
        }
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(client =>
                client.nombre.toLowerCase().includes(lowerTerm) ||
                String(client.ruc).includes(lowerTerm)
            );
        }
        return result;
    }, [allowedClients, selectedRoute, searchTerm]);

    const paginatedClients = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredClients.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredClients, currentPage]);

    const totalPages = Math.ceil(filteredClients.length / itemsPerPage);

    const goToNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
    const goToPrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

    const generatedSchedule = useMemo(() => {
        return filteredClients.flatMap(client => {
            if (client.inactivo) return [];

            const template = client.originalData;
            const rows: RawClientData[] = [];

            Object.entries(client.days).forEach(([dayKey, isChecked]) => {
                if (isChecked) {
                    const newRow = { ...template };
                    const dayName = DAY_NAMES[dayKey as keyof typeof DAY_NAMES];
                    newRow['Día'] = dayName;
                    newRow['Ruta'] = client.ruta;
                    newRow['generatedId'] = `${client.id}-${dayKey}`;
                    rows.push(newRow);
                }
            });
            return rows;
        });
    }, [filteredClients]);

    const handleDownloadExcel = useCallback(() => {
        if (generatedSchedule.length === 0) {
            alert('No hay datos para exportar.');
            return;
        }

        const dataToExport = generatedSchedule.map((row) => {
            const getVal = (key: string, ...alternates: string[]) => {
                if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
                for (const alt of alternates) {
                    if (row[alt] !== undefined && row[alt] !== null && row[alt] !== '') return row[alt];
                }
                return '';
            };

            // Prioritize: Ruta, Ruta (Nombre), Cliente, Cliente (Nombre) as requested
            return {
                'Ruta': getVal('Ruta', 'route_code'),
                'Ruta (Nombre)': getVal('Ruta (Nombre)', 'Ruta (Nombre)') || getVal('Ruta', 'route_code'), // Fallback to code if name missing
                'Cliente': getVal('Cliente', 'customer_code', 'RUC', 'ruc', 'code'), // Client ID
                'Cliente (Nombre)': getVal('Cliente (Nombre)', 'Nombre a Mostrar', 'customer_code_lookup', 'name', 'Nombre'), // Client Name
                // Standard Fields
                'Código': '',
                'Cliente (Identificación)': getVal('Cliente (Identificación)', 'RUC', 'ruc', 'identity_', 'code'),
                'Cliente (Comentario)': getVal('Ruta', 'route_code'),
                'Cliente (Estatus)': '1',
                'Dirección': getVal('Dirección', 'customer_address_code', 'address_code', 'code'),
                'Dirección (Nombre)': getVal('Dirección', 'customer_address_code', 'address_code', 'code'),
                'Dirección (Descripción)': getVal('Dirección (Descripción)', 'address', 'description'),
                'Dirección (Calle principal)': getVal('Dirección (Calle principal)', 'main_street'),
                'Dirección (Calle secundaria)': getVal('Dirección (Calle secundaria)', 'secondary_street'),
                'Dirección (Nomenclatura)': getVal('Dirección (Nomenclatura)', 'nomenclature'),
                'Dirección (Referencia)': getVal('Dirección (Referencia)', 'reference'),
                'Dirección (Teléfono)': getVal('Dirección (Teléfono)', 'Teléfono', 'phone', 'contact'),
                'Dirección (Fax)': getVal('Dirección (Fax)', 'fax'),
                'Semana': getVal('Semana', 'week') || '1',
                'Día': row['Día'],
                'Secuencia': getVal('Secuencia', 'sequence') || '0',
                'Estatus': 'Activo'
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Planilla");
        XLSX.writeFile(workbook, `Planilla_Rutas_${selectedRoute ? selectedRoute : 'Completa'}.xlsx`);
    }, [generatedSchedule, selectedRoute]);

    const handleSaveToSupabase = async () => {
        if (clients.length === 0) {
            alert('No hay datos para guardar.');
            return;
        }

        setIsLoading(true);
        setLoadingMessage('Guardando en base de datos...');

        try {
            const cleanString = (val: any): string | null => {
                if (val === undefined || val === null || val === '') return null;
                return String(val).trim();
            };

            const rawPayload = clients.map(client => ({
                'RUC': client.ruc ? String(client.ruc).trim() : null,
                'Nombre a Mostrar': client.nombre,
                'Teléfono': client.telefono,
                'Categoria': client.categoria,
                'Latitud geográfica': cleanString(client.originalData['Latitud geográfica'] || client.originalData['Latitud']),
                'Longitud geográfica': cleanString(client.originalData['Longitud geográfica'] || client.originalData['Longitud']),
                'ZONA': cleanString(client.originalData['ZONA']),
                'Ruta': client.ruta,
                'L': client.days.lunes,
                'M': client.days.martes,
                'X': client.days.miercoles,
                'J': client.days.jueves,
                'V': client.days.viernes,
                'S': client.days.sabado,
                'INACTIVO': client.inactivo,
                'Novedad': cleanString(client.originalData['Novedad'])
            }));

            const validPayload = rawPayload.filter(item => item['RUC']);

            const uniquePayloadMap = new Map();
            validPayload.forEach(item => {
                uniquePayloadMap.set(item['RUC'], item);
            });

            const finalPayload = Array.from(uniquePayloadMap.values());

            if (finalPayload.length === 0) {
                alert('No se encontraron clientes con RUC válido para guardar.');
                setIsLoading(false);
                return;
            }

            const { error } = await supabase
                .from('routes')
                .upsert(finalPayload, { onConflict: 'RUC' });

            if (error) throw error;

            // Detección de Móvil: Si es ancho menor a 768px (breakpoint 'md' de tailwind)
            if (window.innerWidth < 768) {
                setShowSuccessModal(true);
            } else {
                showToast('Datos guardados exitosamente en la tabla "routes".', 'success');
            }

        } catch (error: any) {
            let message = 'Ha ocurrido un error desconocido.';
            let code = '';
            let details = '';
            let hint = '';

            if (error) {
                if (typeof error === 'object') {
                    if (error.message) message = error.message;
                    if (error.code) code = String(error.code);
                    if (error.details) details = error.details;
                    if (error.hint) hint = error.hint;
                } else if (typeof error === 'string') {
                    message = error;
                }
            }

            let alertText = `Error al guardar en la Base de Datos (Code: ${code || 'N/A'}):\n\n${message}`;
            if (details) alertText += `\n\nDetalles: ${details}`;
            if (hint) alertText += `\n\nPista: ${hint}`;

            if (code === '22P02') {
                alertText += `\n\n--------------------------------------------------\nACCIÓN REQUERIDA:\nLa base de datos rechazó las coordenadas porque la columna espera números y estamos enviando texto.\n\nSOLUCIÓN: Ejecuta este script en Supabase SQL Editor:\n\nALTER TABLE public.routes ALTER COLUMN "Latitud geográfica" TYPE text;\nALTER TABLE public.routes ALTER COLUMN "Longitud geográfica" TYPE text;`;
            }

            alert(alertText);

        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };

    const handleApiSync = async (clientsOverride?: DisplayClient[]) => {
        setIsLoading(true);
        setLoadingMessage('Conectando a API...');

        const clientsToProcess = clientsOverride || clients;

        try {
            const commonOptions: RequestInit = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'omit'
            };

            const loginBody = JSON.stringify({
                "action": "login",
                "login": "7",
                "password": "Aqua2026.",
                "context": "grupoaqua"
            });

            const loginRes = await fetchWithCors('https://s31.mobilvendor.com/web-service', {
                ...commonOptions,
                body: loginBody
            });

            if (!loginRes.ok) throw new Error(`Error HTTP en login: ${loginRes.status}`);
            const loginData = await loginRes.json();
            const fetchedSessionId = loginData.session_id;

            if (!fetchedSessionId) throw new Error("No se recibió session_id.");
            setSessionId(fetchedSessionId);

            setLoadingMessage('Descargando clientes (Página 1)...');

            let page = 1;
            let totalPages = 1;
            const allCustomerRecords: any[] = [];

            do {
                const customersBody = JSON.stringify({
                    "session_id": fetchedSessionId,
                    "action": "get",
                    "schema": "customers",
                    "page": page,
                    "limit": 1000
                });

                const customersRes = await fetchWithCors('https://s31.mobilvendor.com/web-service', {
                    ...commonOptions,
                    body: customersBody
                });

                const customersData = await customersRes.json();

                if (customersData.records) {
                    allCustomerRecords.push(...customersData.records);
                }

                totalPages = customersData.pages || 1;
                setLoadingMessage(`Descargando clientes (Página ${page} de ${totalPages})...`);
                page++;

            } while (page <= totalPages);

            setLoadingMessage('Descargando direcciones (Página 1)...');

            page = 1;
            totalPages = 1;
            const allAddressRecords: any[] = [];

            do {
                const addressesBody = JSON.stringify({
                    "session_id": fetchedSessionId,
                    "action": "get",
                    "schema": "customer_addresses",
                    "page": page,
                    "limit": 1000
                });

                const addressesRes = await fetchWithCors('https://s31.mobilvendor.com/web-service', {
                    ...commonOptions,
                    body: addressesBody
                });

                const addressesData = await addressesRes.json();

                if (addressesData.records) {
                    allAddressRecords.push(...addressesData.records);
                }

                totalPages = addressesData.pages || 1;
                setLoadingMessage(`Descargando direcciones (Página ${page} de ${totalPages})...`);
                page++;
            } while (page <= totalPages);

            const customerMap = new Map(allCustomerRecords.map((c: any) => [String(c.code), c]));
            const rucMap = new Map(allCustomerRecords.map((c: any) => [String(c.identity_), c]));

            const addressMap = new Map(allAddressRecords.map((a: any) => [String(a.code), a]));
            const customerAddressMap = new Map(allAddressRecords.map((a: any) => [String(a.customer_code), a]));


            if (clientsToProcess.length > 0) {
                setLoadingMessage('Enriqueciendo datos de Excel con API...');

                const updatedClients = clientsToProcess.map(client => {
                    const id = client.id;
                    const idStr = String(id);

                    let apiData = customerMap.get(idStr) || rucMap.get(idStr);

                    if (!apiData && client.nombre && client.nombre !== 'Sin Nombre') {
                        const searchName = client.nombre.toString().toUpperCase().trim();
                        if (searchName.length > 3) {
                            apiData = allCustomerRecords.find((c: any) =>
                                c.name && c.name.toString().toUpperCase().includes(searchName)
                            );
                        }
                    }

                    let addressData: any = null;
                    const addrCode = client.originalData?.['Dirección'] || client.originalData?.['customer_address_code'];

                    if (addrCode) {
                        addressData = addressMap.get(String(addrCode));
                    }

                    if (!addressData) {
                        const customerCode = apiData?.code || id;
                        addressData = customerAddressMap.get(String(customerCode));
                    }

                    if (apiData || addressData) {
                        const addressDesc = addressData?.description || addressData?.address || addressData?.street1 || apiData?.description || apiData?.address || apiData?.street1 || client.originalData['Dirección (Descripción)'];
                        return {
                            ...client,
                            ruc: apiData?.identity_ || client.ruc,
                            nombre: apiData?.name || client.nombre,
                            telefono: (addressData?.phone || addressData?.contact) || (apiData?.contact || apiData?.phone) || client.telefono,
                            categoria: apiData?.price_list_code_lookup || client.categoria,
                            addressDescription: addressDesc,
                            originalData: {
                                ...client.originalData,
                                'Cliente (Nombre)': apiData?.name || client.originalData['Cliente (Nombre)'],
                                'Cliente (Identificación)': apiData?.identity_ || client.originalData['Cliente (Identificación)'],
                                'Cliente': apiData?.code || client.originalData['Cliente'],
                                'Cliente (Comentario)': client.ruta || apiData?.route_code || client.originalData['Ruta'],
                                'Cliente (Estatus)': '1',
                                'Dirección (Descripción)': addressDesc,
                                'Dirección (Teléfono)': addressData?.phone || addressData?.contact || apiData?.phone || apiData?.contact || client.originalData['Dirección (Teléfono)'],
                                'Dirección (Fax)': addressData?.fax || client.originalData['Dirección (Fax)'],
                                'Dirección (Calle principal)': addressData?.main_street || addressData?.street1 || client.originalData['Dirección (Calle principal)'],
                                'Dirección (Calle secundaria)': addressData?.secondary_street || client.originalData['Dirección (Calle secundaria)'],
                                'Dirección (Nomenclatura)': addressData?.nomenclature || client.originalData['Dirección (Nomenclatura)'],
                                'Dirección (Referencia)': addressData?.reference || client.originalData['Dirección (Referencia)'],
                                'Dirección': addressData?.code || client.originalData['Dirección'],
                                'Dirección (Nombre)': addressData?.code || client.originalData['Dirección (Nombre)'],
                            }
                        };
                    }
                    return client;
                });

                setClients(updatedClients);
                showToast('Datos enriquecidos con API exitosamente.', 'success');

            } else {
                alert('Primero carga un Excel o carga desde la BD para sincronizar y enriquecer los datos.');
            }

        } catch (error: any) {
            console.error(error);
            alert(`Error en sincronización: ${error.message}`);
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };


    return (
        <div className="space-y-6">
            <Toast
                message={toast?.message || ''}
                type={toast?.type || 'success'}
                show={!!toast}
                onClose={() => setToast(null)}
            />

            <SuccessModal
                isOpen={showSuccessModal}
                onClose={() => setShowSuccessModal(false)}
                message="Se ha guardado exitosamente."
            />

            <AddClientModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onAddClient={handleAddNewClient}
                existingSessionId={sessionId}
                availableRoutes={uniqueRoutes}
            />

            {/* --- BARRA DE HERRAMIENTAS PRINCIPAL --- */}
            <div className="flex flex-col gap-4 bg-[#162B25] p-4 rounded-xl shadow-sm border border-[#BEDACC]/20">

                {/* Fila Superior: Botones de Acción */}
                <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4">

                    {/* Grupo Botones */}
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
                        {isAdmin && (
                            <label className="flex items-center justify-center gap-2 bg-[#162B25] border border-[#6BAF8E]/50 hover:bg-[#6BAF8E]/10 text-[#6BAF8E] px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm font-medium">
                                <UploadIcon className="w-5 h-5" />
                                <span className="hidden lg:inline">Importar</span>
                                <input type="file" className="hidden" onChange={handleFileUpload} accept=".xlsx, .xls, .csv" />
                            </label>
                        )}

                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="flex items-center justify-center gap-2 bg-[#162B25] border border-[#6BAF8E]/50 hover:bg-[#6BAF8E]/10 text-[#6BAF8E] px-3 py-2 rounded-lg transition-colors text-sm font-medium"
                        >
                            <UserAddIcon className="w-5 h-5" />
                            <span className="hidden lg:inline">Agregar</span>
                        </button>

                        {isAdmin && (
                            <button
                                onClick={handleLoadFromSupabase}
                                className="flex items-center justify-center gap-2 bg-[#162B25] border border-[#6BAF8E]/50 hover:bg-[#6BAF8E]/10 text-[#6BAF8E] px-3 py-2 rounded-lg transition-colors disabled:opacity-50 text-sm font-medium"
                                disabled={isLoading}
                            >
                                <DatabaseIcon className="w-5 h-5" />
                                <span className="hidden lg:inline">Recargar</span>
                            </button>
                        )}

                        {isAdmin && (
                            <button
                                onClick={() => handleApiSync()}
                                className="flex items-center justify-center gap-2 bg-[#162B25] border border-[#6BAF8E]/50 hover:bg-[#6BAF8E]/10 text-[#6BAF8E] px-3 py-2 rounded-lg transition-colors disabled:opacity-50 text-sm font-medium"
                                disabled={isLoading}
                            >
                                <CloudIcon className="w-5 h-5" />
                                <span className="hidden lg:inline">Sincronizar</span>
                            </button>
                        )}

                        {/* BOTÓN GUARDAR DESTACADO */}
                        <button
                            onClick={handleSaveToSupabase}
                            className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 bg-[#6BAF8E] hover:bg-[#5A9E7E] text-[#162B25] px-6 py-2 rounded-lg font-bold transition-all disabled:opacity-50 shadow-md border border-white/10 transform hover:scale-105"
                            disabled={isLoading}
                        >
                            <SaveIcon className="w-5 h-5" />
                            <span>GUARDAR</span>
                        </button>

                        {isAdmin && (
                            <button
                                onClick={async () => {
                                    setIsLoading(true);
                                    setLoadingMessage('Actualizando catálogo maestro...');
                                    await handleSyncMasterCustomers();
                                    setIsLoading(false);
                                    setLoadingMessage('');
                                }}
                                className="hidden sm:flex items-center justify-center bg-[#162B25] border border-[#6BAF8E]/50 hover:bg-[#6BAF8E]/10 text-[#6BAF8E] px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                                title="Actualizar catálogo maestro"
                                disabled={isLoading}
                            >
                                <RefreshIcon className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Fila Inferior: Filtros y Búsqueda */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-[#BEDACC]/10">
                    {/* Buscador Manual */}
                    <div className="relative w-full sm:flex-1">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <SearchIcon className="w-5 h-5 text-[#BEDACC]/50" />
                        </div>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar cliente por Nombre o RUC..."
                            className="bg-[#162B25] border border-[#BEDACC]/30 text-[#BEDACC] text-sm rounded-lg focus:ring-[#6BAF8E] focus:border-[#6BAF8E] block w-full pl-10 p-2.5 outline-none placeholder-[#BEDACC]/30"
                        />
                    </div>

                    {/* Filtro Ruta */}
                    <div className="relative w-full sm:w-64">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <FilterIcon className="w-5 h-5 text-[#BEDACC]/50" />
                        </div>
                        <select
                            value={selectedRoute}
                            onChange={(e) => setSelectedRoute(e.target.value)}
                            className="bg-[#162B25] border border-[#BEDACC]/30 text-[#BEDACC] text-sm rounded-lg focus:ring-[#6BAF8E] focus:border-[#6BAF8E] block w-full pl-10 p-2.5 appearance-none outline-none"
                        >
                            <option value="">Todas las Rutas</option>
                            {uniqueRoutes.map(route => (
                                <option key={route} value={route}>
                                    Ruta {route}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="text-sm text-[#BEDACC]/60 whitespace-nowrap self-center hidden sm:block">
                        {filteredClients.length} clientes
                    </div>
                </div>
            </div>

            {isLoading && (
                <div className="fixed inset-0 bg-[#162B25]/90 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-[#162B25] p-6 rounded-xl shadow-2xl flex flex-col items-center border border-[#BEDACC]/30">
                        <Spinner />
                        <p className="mt-4 text-[#BEDACC] font-medium animate-pulse">{loadingMessage}</p>
                    </div>
                </div>
            )}

            <Card className="overflow-hidden flex flex-col">
                <div className="block md:hidden divide-y divide-[#BEDACC]/10">
                    {filteredClients.length === 0 ? (
                        <div className="p-8 text-center text-[#BEDACC]/50">
                            No hay clientes cargados o ninguno coincide con el filtro.
                        </div>
                    ) : (
                        paginatedClients.map((client) => (
                            <div key={client.id} className={`p-4 ${client.inactivo ? 'opacity-60 bg-[#162B25]/90' : 'bg-[#162B25]'}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1 mr-2">
                                        <div className="font-bold text-[#BEDACC] text-sm uppercase tracking-wide">{client.nombre}</div>
                                        <div className="text-xs text-[#BEDACC]/60 font-mono mt-1">{client.ruc}</div>

                                        {/* Mobile Address Editing Section */}
                                        {editingAddressClientId === client.id ? (
                                            <div className="mt-2 bg-[#BEDACC]/10 p-2 rounded">
                                                {isLoadingAddresses ? (
                                                    <div className="flex items-center gap-2 text-xs text-[#BEDACC]">
                                                        <Spinner /> Buscando sucursales...
                                                    </div>
                                                ) : availableAddresses.length > 0 ? (
                                                    <select
                                                        autoFocus
                                                        onChange={(e) => handleAddressChange(client, Number(e.target.value))}
                                                        className="w-full text-xs bg-[#162B25] border border-[#6BAF8E] text-[#BEDACC] rounded p-1 outline-none"
                                                    >
                                                        <option value="">Seleccionar Sucursal...</option>
                                                        {availableAddresses.map((addr, idx) => (
                                                            <option key={addr.code || idx} value={idx}>
                                                                {addr.description || addr.address || 'Sin descripción'}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <div className="text-xs text-orange-400">Sin sucursales adicionales.</div>
                                                )}
                                                <button
                                                    onClick={() => setEditingAddressClientId(null)}
                                                    className="text-[10px] text-red-400 mt-1 underline"
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-start gap-2 mt-1">
                                                <div className="text-xs text-[#BEDACC] font-medium bg-[#BEDACC]/10 p-1 rounded inline-block">
                                                    {client.addressDescription || 'Sin dirección'}
                                                </div>
                                                <button
                                                    onClick={() => handleLoadAddresses(client)}
                                                    className="p-1 hover:bg-[#6BAF8E]/20 rounded text-[#6BAF8E] transition-colors"
                                                    title="Cambiar Sucursal"
                                                >
                                                    <MapPinIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <span className="bg-[#D2B858] text-[#162B25] px-2 py-1 rounded text-xs font-bold whitespace-nowrap ml-2">
                                        {client.ruta}
                                    </span>
                                </div>

                                {/* Selector de Patrones Móvil */}
                                <div className="mt-4 mb-2">
                                    <label className="block text-xs font-medium text-[#BEDACC]/60 mb-1">Asignar Días de Visita</label>
                                    <select
                                        className="w-full bg-[#162B25] border border-[#BEDACC]/30 text-[#BEDACC] rounded-lg text-sm p-2 focus:ring-1 focus:ring-[#6BAF8E] outline-none"
                                        value={getClientPattern(client)}
                                        onChange={(e) => handlePatternChange(client.id, e.target.value)}
                                    >
                                        <option value="none">Sin visitas asignadas</option>
                                        <optgroup label="Combinaciones Comunes">
                                            {VISIT_PATTERNS.filter(p => p.id.includes('-')).map(p => (
                                                <option key={p.id} value={p.id}>{p.label}</option>
                                            ))}
                                        </optgroup>
                                        <optgroup label="Días Individuales">
                                            {VISIT_PATTERNS.filter(p => !p.id.includes('-')).map(p => (
                                                <option key={p.id} value={p.id}>{p.label}</option>
                                            ))}
                                        </optgroup>
                                        <option value="inactivo">Inactivo (Sin Ruta)</option>
                                        <option value="custom" disabled>Personalizado (Selección manual)</option>
                                    </select>
                                </div>

                                <div className="flex justify-between items-center mt-3 pt-2 border-t border-[#BEDACC]/10">
                                    {/* Indicadores Visuales de Días */}
                                    <div className="flex gap-1.5">
                                        {(['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as const).map((day) => (
                                            <button
                                                key={day}
                                                onClick={() => !client.inactivo && handleDayChange(client.id, day, !client.days[day])}
                                                disabled={client.inactivo}
                                                className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors border ${client.days[day]
                                                        ? 'bg-[#6BAF8E] text-[#162B25] border-[#6BAF8E]'
                                                        : 'bg-transparent text-[#BEDACC]/30 border-[#BEDACC]/10'
                                                    }`}
                                            >
                                                {day.charAt(0).toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left text-[#BEDACC]">
                        <thead className="text-xs text-[#BEDACC]/70 uppercase bg-[#162B25] border-b border-[#BEDACC]/20 sticky top-0">
                            <tr>
                                <th scope="col" className="px-6 py-3">RUC / ID</th>
                                <th scope="col" className="px-6 py-3">Cliente</th>
                                <th scope="col" className="px-6 py-3">Ruta</th>
                                <th scope="col" className="px-6 py-3 text-center">L</th>
                                <th scope="col" className="px-6 py-3 text-center">M</th>
                                <th scope="col" className="px-6 py-3 text-center">X</th>
                                <th scope="col" className="px-6 py-3 text-center">J</th>
                                <th scope="col" className="px-6 py-3 text-center">V</th>
                                <th scope="col" className="px-6 py-3 text-center">S</th>
                                <th scope="col" className="px-6 py-3 text-center">Inactivo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#BEDACC]/10">
                            {filteredClients.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="px-6 py-12 text-center text-[#BEDACC]/50">
                                        No hay clientes cargados o ninguno coincide con el filtro.
                                    </td>
                                </tr>
                            ) : (
                                paginatedClients.map((client) => (
                                    <tr key={client.id} className={`hover:bg-[#6BAF8E]/10 transition-colors ${client.inactivo ? 'opacity-50 bg-[#162B25]/80' : ''}`}>
                                        <td className="px-6 py-4 font-medium text-[#BEDACC] whitespace-nowrap">{client.ruc}</td>
                                        <td className="px-6 py-4">
                                            <div className="text-[#BEDACC] font-bold uppercase tracking-wide">{client.nombre}</div>

                                            {/* Desktop Address Editing */}
                                            <div className="mt-1 font-medium min-h-[1rem] flex items-center gap-2">
                                                {editingAddressClientId === client.id ? (
                                                    <div className="flex items-center gap-2 w-full max-w-sm">
                                                        {isLoadingAddresses ? (
                                                            <div className="flex items-center gap-2 text-xs text-[#BEDACC]">
                                                                <Spinner />
                                                            </div>
                                                        ) : (
                                                            <select
                                                                autoFocus
                                                                onChange={(e) => handleAddressChange(client, Number(e.target.value))}
                                                                onBlur={() => setEditingAddressClientId(null)}
                                                                className="text-xs bg-[#162B25] border border-[#6BAF8E] text-[#BEDACC] rounded p-1 outline-none w-full"
                                                            >
                                                                <option value="">Seleccionar sucursal...</option>
                                                                {availableAddresses.length > 0 ? (
                                                                    availableAddresses.map((addr, idx) => (
                                                                        <option key={addr.code || idx} value={idx}>
                                                                            {addr.description || addr.address || addr.street1 || 'Sin descripción'}
                                                                        </option>
                                                                    ))
                                                                ) : (
                                                                    <option disabled>Sin resultados</option>
                                                                )}
                                                            </select>
                                                        )}
                                                        <button
                                                            onClick={() => setEditingAddressClientId(null)}
                                                            className="text-red-400 hover:text-red-300"
                                                        >
                                                            <XCircleIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="text-xs text-[#BEDACC]/80 truncate max-w-[200px]" title={client.addressDescription}>
                                                            {client.addressDescription || <span className="text-[#BEDACC]/40 italic text-[10px]">Cargando...</span>}
                                                        </div>
                                                        <button
                                                            onClick={() => handleLoadAddresses(client)}
                                                            className="text-[#BEDACC]/40 hover:text-[#6BAF8E] transition-colors"
                                                            title="Cambiar sucursal/dirección"
                                                        >
                                                            <MapPinIcon className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="bg-[#D2B858] text-[#162B25] px-2 py-1 rounded text-xs font-bold border border-[#D2B858]/50">
                                                {client.ruta}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center">
                                                <Checkbox
                                                    checked={client.days.lunes}
                                                    onChange={(e) => handleDayChange(client.id, 'lunes', e.target.checked)}
                                                    disabled={client.inactivo}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center">
                                                <Checkbox
                                                    checked={client.days.martes}
                                                    onChange={(e) => handleDayChange(client.id, 'martes', e.target.checked)}
                                                    disabled={client.inactivo}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center">
                                                <Checkbox
                                                    checked={client.days.miercoles}
                                                    onChange={(e) => handleDayChange(client.id, 'miercoles', e.target.checked)}
                                                    disabled={client.inactivo}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center">
                                                <Checkbox
                                                    checked={client.days.jueves}
                                                    onChange={(e) => handleDayChange(client.id, 'jueves', e.target.checked)}
                                                    disabled={client.inactivo}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center">
                                                <Checkbox
                                                    checked={client.days.viernes}
                                                    onChange={(e) => handleDayChange(client.id, 'viernes', e.target.checked)}
                                                    disabled={client.inactivo}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center">
                                                <Checkbox
                                                    checked={client.days.sabado}
                                                    onChange={(e) => handleDayChange(client.id, 'sabado', e.target.checked)}
                                                    disabled={client.inactivo}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center">
                                                <Checkbox
                                                    checked={client.inactivo}
                                                    onChange={(e) => handleStatusChange(client.id, e.target.checked)}
                                                    className="text-red-500 border-red-500/50"
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {filteredClients.length > 0 && (
                    <div className="bg-[#162B25] px-4 py-3 border-t border-[#BEDACC]/20 flex items-center justify-between sm:px-6">
                        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm text-[#BEDACC]/60">
                                    Mostrando <span className="font-medium text-[#BEDACC]">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-medium text-[#BEDACC]">{Math.min(currentPage * itemsPerPage, filteredClients.length)}</span> de <span className="font-medium text-[#BEDACC]">{filteredClients.length}</span> resultados
                                </p>
                            </div>
                            <div>
                                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                    <button
                                        onClick={goToPrevPage}
                                        disabled={currentPage === 1}
                                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-[#BEDACC]/30 bg-[#162B25] text-sm font-medium text-[#BEDACC] hover:bg-[#BEDACC]/10 disabled:opacity-30"
                                    >
                                        <ChevronLeftIcon className="h-5 w-5" />
                                    </button>
                                    <span className="relative inline-flex items-center px-4 py-2 border border-[#BEDACC]/30 bg-[#162B25] text-sm font-medium text-[#BEDACC]">
                                        {currentPage} / {totalPages}
                                    </span>
                                    <button
                                        onClick={goToNextPage}
                                        disabled={currentPage === totalPages}
                                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-[#BEDACC]/30 bg-[#162B25] text-sm font-medium text-[#BEDACC] hover:bg-[#BEDACC]/10 disabled:opacity-30"
                                    >
                                        <ChevronRightIcon className="h-5 w-5" />
                                    </button>
                                </nav>
                            </div>
                        </div>
                        <div className="flex items-center justify-between w-full sm:hidden">
                            <button
                                onClick={goToPrevPage}
                                disabled={currentPage === 1}
                                className="relative inline-flex items-center px-4 py-2 border border-[#BEDACC]/30 text-sm font-medium rounded-md text-[#BEDACC] bg-[#162B25] hover:bg-[#BEDACC]/10 disabled:opacity-50"
                            >
                                Anterior
                            </button>
                            <span className="text-sm text-[#BEDACC]/60">
                                {currentPage} / {totalPages}
                            </span>
                            <button
                                onClick={goToNextPage}
                                disabled={currentPage === totalPages}
                                className="relative inline-flex items-center px-4 py-2 border border-[#BEDACC]/30 text-sm font-medium rounded-md text-[#BEDACC] bg-[#162B25] hover:bg-[#BEDACC]/10 disabled:opacity-50"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                )}
            </Card>

            {isAdmin && (
                <Card className="p-6 bg-[#162B25] border-[#BEDACC]/20">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-[#BEDACC]">Planilla Generada {selectedRoute && `(Ruta ${selectedRoute})`}</h2>
                            <p className="text-sm text-[#BEDACC]/60 mt-1">
                                Vista previa de las filas que se exportarán ({generatedSchedule.length} registros)
                            </p>
                        </div>
                        <button
                            onClick={handleDownloadExcel}
                            disabled={generatedSchedule.length === 0}
                            className="flex items-center gap-2 bg-[#D2B858] hover:bg-[#c4aa4f] disabled:opacity-50 disabled:cursor-not-allowed text-[#162B25] px-4 py-2 rounded-lg transition-colors font-bold shadow-sm"
                        >
                            <DownloadIcon className="w-5 h-5" />
                            Exportar Excel
                        </button>
                    </div>

                    <div className="bg-[#162B25] rounded-lg border border-[#BEDACC]/20 overflow-hidden max-h-96 overflow-y-auto">
                        {generatedSchedule.length > 0 ? (
                            <table className="w-full text-xs text-left text-[#BEDACC]/80">
                                <thead className="text-xs text-[#BEDACC]/60 uppercase bg-[#162B25] border-b border-[#BEDACC]/10 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2">Ruta</th>
                                        <th className="px-4 py-2">Cliente</th>
                                        <th className="px-4 py-2">Día</th>
                                        <th className="px-4 py-2">Dirección</th>
                                        <th className="px-4 py-2">Descripción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#BEDACC]/10">
                                    {generatedSchedule.slice(0, 100).map((row: any) => (
                                        <tr key={row.generatedId} className="hover:bg-[#BEDACC]/5">
                                            <td className="px-4 py-2 font-mono text-[#BEDACC] font-bold">{row['Ruta']}</td>
                                            <td className="px-4 py-2 text-white">{row['Cliente (Nombre)']}</td>
                                            <td className="px-4 py-2 text-[#BEDACC]">{row['Día']}</td>
                                            <td className="px-4 py-2">{row['Dirección']}</td>
                                            <td className="px-4 py-2 truncate max-w-xs">{row['Dirección (Descripción)']}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-8 text-center text-[#BEDACC]/40">
                                Selecciona días en la tabla superior para generar la planilla.
                            </div>
                        )}
                    </div>
                </Card>
            )}
        </div>
    );
};

export default ClientManagementScreen;