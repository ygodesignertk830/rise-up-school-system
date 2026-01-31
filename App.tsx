import React, { useState, useEffect, useRef } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard'; // School Dashboard
import SuperAdminDashboard from './components/SuperAdminDashboard'; // Owner Dashboard
import { Student, Payment, Class, UserRole } from './types';
import { supabase } from './lib/supabaseClient';
import { getLocalDateString, calculateNextMonthSameDay } from './utils/finance';
import { Lock, AlertTriangle, Phone } from 'lucide-react';
import { showToast, showAlert, showConfirm } from './utils/alerts';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('school_admin');
  const [userEmail, setUserEmail] = useState(''); // NEW
  const [isLoading, setIsLoading] = useState(true);

  // School Status State (The "Gatekeeper")
  const [isSchoolBlocked, setIsSchoolBlocked] = useState(false);
  const [subscriptionDueDate, setSubscriptionDueDate] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string>(''); // New State

  // Data State
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [school, setSchool] = useState<any | null>(null); // Full school object
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);

  // Prevent double fetching
  const fetchingProfileRef = useRef(false);
  const lastFetchRef = useRef<number>(0); // NEW: Debounce fetch

  // Ref to track blocked status inside closures
  const isSchoolBlockedRef = useRef(false);
  const isAuthenticatedRef = useRef(false);
  const initialLoadComplete = useRef(false); // <--- NEW: Track first successful load

  useEffect(() => {
    console.log("🚀 [APP MOUNT] Inicializando sistema...");

    const watchdog = setTimeout(() => {
      if (fetchingProfileRef.current || isLoading) {
        console.error("❌ [WATCHDOG] Timeout atingido. Forçando desbloqueio.");
        fetchingProfileRef.current = false;
        setIsLoading(false);
      }
    }, 15000);

    // 1. CARGA INICIAL (Garantia para F5)
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log("✅ [INIT] Sessão restaurada via getSession()");
          setIsAuthenticated(true);
          isAuthenticatedRef.current = true;
          await handleUserProfile(session.user.id, session.user.email, true);
        } else {
          console.log("ℹ️ [INIT] Nenhuma sessão encontrada no boot.");
          setIsLoading(false);
        }
      } catch (err) {
        console.error("❌ [INIT] Erro no boot:", err);
        setIsLoading(false);
      }
    };

    init();

    // 2. LISTENER DE EVENTOS (SIGNED_IN, SIGNED_OUT, etc)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`🔔 [AUTH EVENT] ${event}`);

      if (event === 'SIGNED_IN' && session) {
        // Se já carregamos via INIT, ignoramos o SIGNED_IN duplicado do boot
        if (initialLoadComplete.current) {
          console.log("⏭️ [AUTH] SIGNED_IN ignorado (já carregado pelo boot).");
          return;
        }
        setIsAuthenticated(true);
        isAuthenticatedRef.current = true;
        await handleUserProfile(session.user.id, session.user.email, true);
      }

      else if (event === 'SIGNED_OUT') {
        console.log("🔐 [AUTH] Logout detectado. Limpando...");
        localStorage.clear();
        sessionStorage.clear();
        setIsAuthenticated(false);
        isAuthenticatedRef.current = false;
        setStudents([]);
        setPayments([]);
        setClasses([]);
        setSchoolId(null);
        setSchool(null);
        initialLoadComplete.current = false;
        fetchingProfileRef.current = false;
        setIsLoading(false);
      }
    });

    return () => {
      clearTimeout(watchdog);
      subscription.unsubscribe();
    };
  }, []);

  // fetchData PARALELIZADO e Robusto
  const fetchData = async (currentSchoolId: string | null, userId?: string, force = false, overrideRole?: UserRole) => {
    const role = overrideRole || userRole;

    // SÊNIOR: Se for Admin, ele pode querer ver tudo. Se for Escola, precisa de ID.
    if (!currentSchoolId && role !== 'super_admin') {
      console.log("🕵️ Fetch abortado: Faltando contexto.");
      return;
    }

    // SÊNIOR: Debounce mais curto (500ms) mas com lock de início
    const now = Date.now();
    if (!force && lastFetchRef.current !== 0 && (now - lastFetchRef.current < 500)) return;
    lastFetchRef.current = now;

    try {
      const requestId = Math.random().toString(36).substring(7);
      console.log(`📡 [FETCH] Request: ${requestId} | School: ${currentSchoolId}`);

      let studentsQuery = supabase.from('students').select('*').order('name', { ascending: true });
      let classesQuery = supabase.from('classes').select('*').order('name');

      if (currentSchoolId) {
        studentsQuery = studentsQuery.eq('school_id', currentSchoolId);
        classesQuery = classesQuery.eq('school_id', currentSchoolId);
      }

      // SÊNIOR: Timeout de 15s para busca de dados
      const fetchPromise = Promise.all([classesQuery, studentsQuery]);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout (15s) ao buscar dados")), 15000));

      const [classesRes, studentsRes] = await Promise.race([fetchPromise, timeoutPromise]) as any[];

      if (classesRes.error) throw classesRes.error;
      if (studentsRes.error) throw studentsRes.error;

      console.log(`✅ [FETCH] Success: ${requestId} | Students: ${studentsRes.data?.length || 0}`);

      // Atualiza Turmas
      if (classesRes.data) setClasses(classesRes.data);

      // Atualiza Alunos e busca pagamentos
      if (studentsRes.data) {
        const studentsData = studentsRes.data;
        setStudents(studentsData);

        if (studentsData.length > 0) {
          const studentIds = studentsData.map(s => s.id);
          // Otimização: Slice para evitar limites de URI em IN clause se forem milhares (SaaS safety)
          const chunks = [];
          for (let i = 0; i < studentIds.length; i += 100) {
            chunks.push(studentIds.slice(i, i + 100));
          }

          const paymentsPromises = chunks.map(chunk =>
            supabase.from('payments').select('*').in('student_id', chunk)
          );

          const paymentsResponses = await Promise.all(paymentsPromises);
          const allPayments = paymentsResponses.flatMap(res => res.data || []);

          setPayments(allPayments);
        } else {
          setPayments([]);
        }
      }

      console.timeEnd(`⏱️ [${requestId}] Total Fetch`);
    } catch (error: any) {
      console.error('❌ Erro Crítico ao buscar dados:', error);
      showToast("Conexão instável. Usando dados locais.", "warning");
    }
  };

  // Lógica crítica: Verifica perfil, cria se não existir (Auto-Provisioning)
  // FIX: Refatorado para entrada IMEDIATA e Robustez no Reload.
  // 1. Busca User -> 2. Libera Tela -> 3. Background Fetch com IDs já resolvidos
  const handleUserProfile = async (userId: string, userEmail?: string, showLoading = true) => {
    if (fetchingProfileRef.current) {
      console.warn("⚠️ [PROFILE] Bloqueio de concorrência ativo.");
      return;
    }
    fetchingProfileRef.current = true;

    if (showLoading) setIsLoading(true);
    console.log("👤 [PROFILE] Carregando:", userId);

    let resolvedSchoolId: string | null = null;

    try {
      // SÊNIOR: Adicionamos timeout manual (5s) para consulta de perfil
      const profilePromise = supabase.from('users').select('role, school_id, email').eq('id', userId).maybeSingle();
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout (5s) ao buscar perfil")), 5000));

      let { data: userData, error } = await Promise.race([profilePromise, timeoutPromise]) as any;

      // 3. Auto-Provisioning (Se não existir)
      if (!userData) {
        console.log("Perfil não encontrado, criando auto-provisionamento...");

        let targetSchoolId: string | null = null;
        let targetRole: UserRole = 'school_admin';

        if (userEmail) {
          const { data: ownedSchool } = await supabase
            .from('schools')
            .select('id')
            .eq('owner_email', userEmail)
            .maybeSingle();

          if (ownedSchool) targetSchoolId = ownedSchool.id;
        }

        const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });

        if (count === 0) {
          targetRole = 'super_admin';
          targetSchoolId = null;
        } else if (!targetSchoolId) {
          const { data: newSchool } = await supabase.from('schools').insert([{
            name: 'Nova Escola',
            slug: `school-${Date.now()}`,
            active: true,
            owner_email: userEmail
          }]).select().single();
          if (newSchool) targetSchoolId = newSchool.id;
        }

        const { data: newUser } = await supabase.from('users').insert([{
          id: userId,
          email: userEmail || 'user@system.com',
          role: targetRole,
          school_id: targetSchoolId
        }]).select().single();

        userData = newUser;
      }

      // 4. Define Estados Básicos e LIBERA A TELA IMEDIATAMENTE
      if (userData) {
        resolvedSchoolId = userData.school_id;
        setUserRole(userData.role as UserRole);
        setUserEmail(userEmail || (userData as any).email || '');
        setSchoolId(userData.school_id);
      }

      // === AÇÃO: BUSCAR DADOS ANTES DE LIBERAR TELA ===
      if (resolvedSchoolId) {
        // A. Busca Dados da Escola 
        const { data: schoolData, error: schoolError } = await supabase.from('schools').select('*').eq('id', resolvedSchoolId).maybeSingle();

        if (schoolError) console.error("School metadata error:", schoolError);

        if (schoolData) {
          setSchool(schoolData);
          setSchoolName(schoolData.name);
          setSubscriptionDueDate(schoolData.subscription_due_date);

          const today = getLocalDateString();
          if (!schoolData.active || (schoolData.subscription_due_date && schoolData.subscription_due_date < today)) {
            setIsSchoolBlocked(true);
          }
        }

        // B. Busca Dados Operacionais (COM ROLE EXPLÍCITA)
        await fetchData(resolvedSchoolId, userId, true, userData.role as UserRole);
      } else if (userData?.role === 'super_admin') {
        // Super Admin sem escola ainda sim carrega dados globais
        await fetchData(null, userId, true, 'super_admin');
      }

    } catch (error: any) {
      console.error("\n❌ ═══════════════════════════════════════");
      console.error("[PROFILE ERROR] Erro crítico ao carregar perfil:", error);
      console.error("[PROFILE ERROR] Message:", error.message);
      console.error("[PROFILE ERROR] Stack:", error.stack);
      console.error("═══════════════════════════════════════\n");
      showAlert("Erro de Inicialização", "Falha ao carregar perfil: " + (error.message || "Erro desconhecido"), 'error');
    } finally {
      console.log("\n🔓 ═══════════════════════════════════════");
      console.log("[PROFILE END] Liberando trava e finalizando loading...");
      console.log(`[PROFILE] fetchingProfileRef DEPOIS: ${fetchingProfileRef.current} → FALSE`);
      console.log("═══════════════════════════════════════\n");

      // SEMPRE resetar, independente de sucesso ou erro
      setIsLoading(false);
      fetchingProfileRef.current = false;
      initialLoadComplete.current = true;
    }
  };

  // Configurar Realtime Subscriptions
  useEffect(() => {
    if (!isAuthenticated || userRole === 'super_admin' || isSchoolBlocked || !schoolId) return;

    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => {
        console.log("🔔 Realtime: Students changed. Fetching in 500ms...");
        setTimeout(() => fetchData(schoolId), 500);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        console.log("🔔 Realtime: Payments changed. Fetching in 500ms...");
        setTimeout(() => fetchData(schoolId), 500);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, () => {
        setTimeout(() => fetchData(schoolId), 500);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, userRole, isSchoolBlocked, schoolId]);




  const handleLogin = () => {
    // onAuthStateChange will handle this
  };

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      await supabase.auth.signOut();

      // SÊNIOR: Limpeza redundante para garantir cura do "loop"
      localStorage.clear();
      sessionStorage.clear();

      // SÊNIOR: replace('/') é melhor que reload() para SPA
      window.location.replace('/');
    } catch (error) {
      console.error("Erro ao sair:", error);
      window.location.replace('/');
    }
  };

  // --- Ações CRUD ---

  const handleAddClass = async (newClass: Partial<Class>) => {
    if (!schoolId) return;
    try {
      const { data: insertedClass, error } = await supabase.from('classes').insert([{ ...newClass, school_id: schoolId }]).select().single();
      if (error) throw error;
      if (insertedClass) setClasses(prev => [...prev, insertedClass]);
      showToast("Turma criada com sucesso!");
    } catch (error: any) { showAlert("Erro ao criar turma", error.message, 'error'); }
  };

  const handleEditClass = async (updatedClass: Class) => {
    try {
      const { error } = await supabase.from('classes').update({ name: updatedClass.name, teacher: updatedClass.teacher, schedule: updatedClass.schedule, room: updatedClass.room, color: updatedClass.color }).eq('id', updatedClass.id);
      if (error) throw error;
      setClasses(prev => prev.map(c => c.id === updatedClass.id ? updatedClass : c));
      showToast("Turma atualizada!");
    } catch (error: any) { showAlert('Erro ao atualizar', 'Não foi possível salvar alterações', 'error'); }
  };

  const handleDeleteClass = async (classId: string) => {
    const hasStudents = students.some(s => s.class_id === classId);
    if (hasStudents) { showAlert("Ação Negada", "Turma possui alunos. Não pode ser excluída.", "warning"); return; }
    if (!await showConfirm("Excluir turma?", "Esta ação é irreversível.")) return;
    try {
      const { error } = await supabase.from('classes').delete().eq('id', classId);
      if (error) throw error;
      setClasses(prev => prev.filter(c => c.id !== classId));
      showToast("Turma excluída");
    } catch (error) { showAlert('Erro ao excluir', 'Tente novamente.', 'error'); }
  };

  const handleAddStudent = async (newStudent: Student, initialPaymentDate: string) => {
    if (!schoolId) {
      showAlert("Erro de Sistema", "ID da escola não identificado. Tente recarregar a página.", "error");
      console.error("❌ handleAddStudent abortado: schoolId é null");
      return;
    }

    console.log("🚀 Iniciando matrícula:", newStudent);

    try {
      const { id, ...studentData } = newStudent;
      const enrollmentDate = studentData.enrollment_date || getLocalDateString();
      const dateParts = initialPaymentDate.split('-');
      const recurringDueDay = parseInt(dateParts[2]);

      // 1. Inserir Estudante
      const { data: insertedStudent, error: studentError } = await supabase.from('students').insert([{
        school_id: schoolId,
        class_id: studentData.class_id,
        name: studentData.name,
        monthly_fee: studentData.monthly_fee,
        payment_due_day: recurringDueDay,
        enrollment_date: enrollmentDate,
        status: studentData.status,
        photo_url: studentData.photo_url,
        phone: studentData.phone,
        guardian_name: studentData.guardian_name,
        birth_date: studentData.birth_date
      }]).select().single();

      if (studentError) {
        console.error("Erro ao inserir aluno:", studentError);
        throw studentError;
      }

      console.log("✅ Aluno inserido:", insertedStudent);
      setStudents(prev => [...prev, insertedStudent].sort((a, b) => a.name.localeCompare(b.name)));

      // 2. Inserir Pagamento Inicial
      const firstPayment = {
        student_id: insertedStudent.id,
        due_date: initialPaymentDate,
        amount: insertedStudent.monthly_fee,
        status: 'pending'
      };

      const { data: insertedPayment, error: paymentError } = await supabase.from('payments').insert([firstPayment]).select().single();

      if (paymentError) {
        console.error("Erro ao inserir pagamento inicial:", paymentError);
        // Não vamos travar tudo se o pagamento falhar, mas avisar
        showAlert("Aviso", "Aluno criado, mas erro ao gerar 1ª fatura. Verifique no financeiro.", "warning");
      } else {
        if (insertedPayment) setPayments(prev => [...prev, insertedPayment]);
      }

      showToast("Aluno matriculado com sucesso!");
    } catch (error: any) {
      console.error("Erro fatal em handleAddStudent:", error);
      showAlert("Erro", error.message || "Falha ao criar aluno.", 'error');
    }
  };

  const handleEditStudent = async (updatedStudent: Student, specificNextDueDate?: string) => {
    console.log("📝 Enviando UPDATE para Supabase:", updatedStudent);
    try {
      const { error } = await supabase.from('students').update({
        name: updatedStudent.name,
        class_id: updatedStudent.class_id,
        monthly_fee: updatedStudent.monthly_fee,
        payment_due_day: updatedStudent.payment_due_day,
        enrollment_date: updatedStudent.enrollment_date,
        status: updatedStudent.status,
        photo_url: updatedStudent.photo_url,
        phone: updatedStudent.phone,
        guardian_name: updatedStudent.guardian_name,
        birth_date: updatedStudent.birth_date
      }).eq('id', updatedStudent.id);

      if (error) {
        console.error("Erro no update:", error);
        throw error;
      }

      console.log("✅ Update sucesso no DB. Atualizando estado local...");
      setStudents(prev => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s).sort((a, b) => a.name.localeCompare(b.name)));

      // --- LOGIC: UPDATE PAYMENT DATES ---
      if (specificNextDueDate) {
        console.log(`📅 Data específica fornecida: ${specificNextDueDate}. Atualizando boleto atual...`);
        const studentPayments = payments.filter(p => p.student_id === updatedStudent.id && p.status !== 'paid');
        // Update the earliest pending bill
        const earliestPending = studentPayments.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

        if (earliestPending) {
          console.log(`Updating payment ${earliestPending.id} from ${earliestPending.due_date} to ${specificNextDueDate}`);
          await supabase.from('payments').update({ due_date: specificNextDueDate, status: 'pending' }).eq('id', earliestPending.id);

          setPayments(prev => prev.map(p => {
            return p.id === earliestPending.id ? { ...p, due_date: specificNextDueDate, status: 'pending' } : p;
          }));
        }
      } else {
        // Fallback: If no specific date but day changed
        const oldStudentIdx = students.findIndex(s => s.id === updatedStudent.id);
        if (oldStudentIdx !== -1) {
          const oldDay = students[oldStudentIdx].payment_due_day;
          const newDay = updatedStudent.payment_due_day;

          if (oldDay !== newDay) {
            // ... existing logic can stay or be simplified. 
            // For now, let's keep it simple and skip if specificNextDueDate isn't passed (which it should be from UI)
          }
        }
      }

      showToast("Dados atualizados!");
    } catch (error: any) {
      console.error("Erro fatal em handleEditStudent:", error);
      showAlert('Erro ao editar', 'Não foi possível salvar: ' + (error.message || 'Erro desconhecido'), 'error');
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!await showConfirm("Excluir aluno?", "Isso apagará TODO o histórico financeiro e de presença. Confirmar?")) return;

    // Otimístico: Remove logo da tela para UX instantânea
    const originalStudents = [...students];
    const originalPayments = [...payments];

    setStudents(prev => prev.filter(s => s.id !== studentId));
    setPayments(prev => prev.filter(p => p.student_id !== studentId));

    try {
      // SÊNIOR: REMOVIDO deletes manuais de 'payments' e 'attendance'.
      // Confiamos no ON DELETE CASCADE do banco de dados (configurado no SQL).
      // Isso reduz drasticamente a carga no Realtime e evita race conditions.
      const { error: studError } = await supabase
        .from('students')
        .delete()
        .eq('id', studentId);

      if (studError) throw studError;

      showToast("Aluno removido.");
    } catch (error: any) {
      console.error("Erro ao deletar aluno:", error);
      // Reverte estado se falhar no banco
      setStudents(originalStudents);
      setPayments(originalPayments);
      showAlert("Erro ao deletar", "Não foi possível sincronizar com o servidor. Tente novamente.", 'error');
    }
  };

  const handleTogglePaymentStatus = async (paymentId: string) => {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) return;
    const isCurrentlyPaid = payment.status === 'paid';
    const newStatus = isCurrentlyPaid ? 'pending' : 'paid';
    const paidAt = isCurrentlyPaid ? null : new Date().toISOString();

    setPayments(prev => prev.map(p => {
      if (p.id !== paymentId) return p;
      return { ...p, status: newStatus, paid_at: paidAt || undefined };
    }));

    try {
      const { error } = await supabase.from('payments').update({ status: newStatus, paid_at: paidAt }).eq('id', paymentId);
      if (error) throw error;

      // RECURRING LOGIC: Create next month payment automatically
      if (newStatus === 'paid') {
        const nextDueDate = calculateNextMonthSameDay(payment.due_date);

        // Critical Check: Prevent duplicates
        const alreadyExists = payments.some(p => p.student_id === payment.student_id && p.due_date === nextDueDate);

        if (!alreadyExists) {
          const student = students.find(s => s.id === payment.student_id);
          // Use student current fee or fallback to paid amount
          const nextAmount = student ? student.monthly_fee : payment.amount;

          const newPaymentPayload = {
            student_id: payment.student_id,
            due_date: nextDueDate,
            amount: nextAmount,
            status: 'pending'
          };

          const { data: insertedPayment, error: createError } = await supabase
            .from('payments')
            .insert([newPaymentPayload])
            .select()
            .single();

          if (createError) throw createError;

          if (insertedPayment) {
            setPayments(prev => [...prev, insertedPayment]);
            showToast("Próxima mensalidade gerada automaticamente!");
          }
        }
      }

    } catch (error) {
      console.error(error);
      showAlert('Erro', 'Erro ao atualizar pagamento.', 'error');
      fetchData(schoolId);
    }
  };

  const handleForgiveDebt = async (paymentId: string) => {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) return;
    const newStatus = !payment.interest_waived;

    setPayments(prev => prev.map(p => { if (p.id !== paymentId) return p; return { ...p, interest_waived: newStatus }; }));
    try {
      const { error } = await supabase.from('payments').update({ interest_waived: newStatus } as any).eq('id', paymentId);
      if (error) throw error;
      showToast(newStatus ? "Juros perdoados" : "Juros restaurados");
    } catch (error) { showAlert('Erro', 'Erro ao atualizar juros.', 'error'); fetchData(schoolId); }
  };

  const handleUpdatePaymentDate = async (paymentId: string, newDate: string) => {
    try {
      const { error } = await supabase.from('payments').update({ due_date: newDate }).eq('id', paymentId);
      if (error) throw error;

      setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, due_date: newDate } : p));
      showToast("Data de vencimento atualizada!");
    } catch (error: any) {
      showAlert("Erro ao atualizar data", error.message, 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-slate-200 font-outfit">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  if (userRole === 'super_admin') {
    return <SuperAdminDashboard onLogout={handleLogout} />;
  }

  if (isSchoolBlocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-950/30 text-white font-outfit p-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
        <div className="bg-red-900/20 p-10 rounded-3xl border-2 border-red-600/50 backdrop-blur-xl shadow-[0_0_50px_rgba(220,38,38,0.2)] max-w-lg z-10">
          <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
            <Lock className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-4 text-red-200">Acesso Temporariamente Suspenso</h1>
          <p className="text-red-200/80 mb-8 text-lg">
            A assinatura escolar de <strong>{schoolName || 'Sua Escola'}</strong> venceu ou foi suspensa. <br />
            A data limite era: <strong>{subscriptionDueDate ? subscriptionDueDate.split('-').reverse().join('/') : 'Indefinido'}</strong>
          </p>

          <div className="bg-black/30 p-4 rounded-xl border border-red-500/30 mb-8 flex items-center justify-center gap-3">
            <AlertTriangle className="text-yellow-500 w-6 h-6" />
            <span className="text-sm font-medium">Por favor, regularize seu débito.</span>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => window.open('https://wa.me/5568999163122?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20para%20liberar%20o%20acesso%20ao%20Sistema%20Rise%20Up.', '_blank')}
              className="flex items-center justify-center w-full py-3 bg-green-600 hover:bg-green-500 rounded-xl font-bold transition-all shadow-lg"
            >
              <Phone className="w-5 h-5 mr-2" /> Contatar Ygo Designer (WhatsApp)
            </button>
            <button onClick={handleLogout} className="text-sm text-red-400 hover:text-red-300 mt-4 underline">
              Voltar para Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0f172a] min-h-screen text-slate-200 font-outfit">
      <Dashboard
        schoolId={schoolId || ''}
        school={school} // PASS SCHOOL
        onUpdateSchool={(updated) => setSchool(updated)} // NEW HANDLER
        students={students}
        payments={payments}
        classes={classes}
        onAddStudent={handleAddStudent}
        onEditStudent={handleEditStudent}
        onDeleteStudent={handleDeleteStudent}
        onTogglePayment={handleTogglePaymentStatus}
        onUpdatePaymentDate={handleUpdatePaymentDate}
        onForgiveDebt={handleForgiveDebt}
        onLogout={handleLogout}
        onAddClass={handleAddClass}
        onEditClass={handleEditClass}
        onDeleteClass={handleDeleteClass}
        userEmail={userEmail} // PASS EMAIL
      />
    </div>
  );
};

export default App;