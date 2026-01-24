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

  // Ref to track blocked status inside closures
  const isSchoolBlockedRef = useRef(false);
  const isAuthenticatedRef = useRef(false); // <--- NEW: Track auth for closures

  useEffect(() => {
    // 1. WATCHDOG (Anti-Loop): Se o loading demorar mais de 8s, reseta tudo.
    const watchdog = setTimeout(() => {
      setIsLoading((currentLoading) => {
        if (currentLoading) {
          console.warn("⚠️ Watchdog: Loading timeout (8s). Forcing reset.");
          // Opcional: localStorage.clear(); para ser nuclear
          window.location.reload();
          return false;
        }
        return currentLoading;
      });
    }, 8000);

    // 2. Init Session
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Erro de Sessão:", error);
          setIsLoading(false);
          return;
        }

        if (session) {
          setIsAuthenticated(true);
          isAuthenticatedRef.current = true;
          // Tenta carregar perfil, mas garante que loading para se falhar
          await handleUserProfile(session.user.id, session.user.email, true);
        } else {
          // Sem sessão = Não carrega nada, vai pro login
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Exceção Crítica:", err);
        setIsLoading(false);
      }
    };

    initSession();

    // 3. Listener Realtime
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`Auth Event: ${event}`);

      // Ignora eventos irrelevantes para evitar re-render/loops
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return;

      if (event === 'SIGNED_IN' && session) {
        const isFreshLogin = !isAuthenticatedRef.current;
        setIsAuthenticated(true);
        isAuthenticatedRef.current = true;

        // Só carrega perfil se for login novo ou se ainda não tivermos userRole
        if (isFreshLogin || !fetchData) {
          await handleUserProfile(session.user.id, session.user.email, isFreshLogin);
        }
      } else if (event === 'SIGNED_OUT') {
        // Limpeza Total
        setIsAuthenticated(false);
        isAuthenticatedRef.current = false;

        setStudents([]);
        setPayments([]);
        setClasses([]);

        setSchoolId(null);
        setIsSchoolBlocked(false);
        setSubscriptionDueDate(null);
        setSchoolName('');
        isSchoolBlockedRef.current = false;

        fetchingProfileRef.current = false;
        setIsLoading(false); // Garante que loading some
      }
    });

    return () => {
      clearTimeout(watchdog);
      subscription.unsubscribe();
    };
  }, []);

  // Lógica crítica: Verifica perfil, cria se não existir (Auto-Provisioning)
  // FIX: Adicionando parametro opcional para controlar o Loading e evitar loop visual
  const handleUserProfile = async (userId: string, userEmail?: string, showLoading = true) => {
    if (fetchingProfileRef.current) return;
    fetchingProfileRef.current = true;

    // Só exibe o loading se explicitamente solicitado (ex: login inicial)
    // Se for um refresh de aba (showLoading=false), mantém a UI quieta.
    if (showLoading) {
      setIsLoading(true);
    }

    try {
      // 1. Buscar perfil existente
      let { data: userData, error } = await supabase
        .from('users')
        .select('role, school_id, email')
        .eq('id', userId)
        .single();

      // 2. SINCRONIZAÇÃO DE ACESSO (Opcional, mas sênior)
      // Se já existe um perfil, mas há uma regra na 'authorized_access', a regra vence (override).
      if (userEmail) {
        const { data: authRecord } = await supabase
          .from('authorized_access')
          .select('school_id, role')
          .eq('email', userEmail.toLowerCase())
          .maybeSingle();

        if (authRecord && userData) {
          // Se a escola ou o cargo mudou na autorização, atualiza o perfil do usuário
          if (userData.school_id !== authRecord.school_id || userData.role !== authRecord.role) {
            console.log("Atualizando acesso do usuário baseado em novas permissões...");
            const { error: updateError } = await supabase
              .from('users')
              .update({
                school_id: authRecord.school_id,
                role: authRecord.role
              })
              .eq('id', userId);

            if (!updateError) {
              userData.school_id = authRecord.school_id;
              userData.role = authRecord.role;
            }
          }
        }
      }

      // 3. Se não existir perfil na tabela 'public.users', cria automaticamente
      if (!userData || error) {
        console.log("Perfil não encontrado, criando auto-provisionamento...");

        // Lógica de Atribuição de Escola (Repete o check acima para o INSERT inicial)
        let targetSchoolId: string | null = null;
        let targetRole: UserRole = 'school_admin';

        if (userEmail) {
          // 1. PRIORIDADE: Checa tabela de acessos autorizados (Gestão de Usuários)
          const { data: authorizedAccess } = await supabase
            .from('authorized_access')
            .select('school_id, role')
            .eq('email', userEmail.toLowerCase())
            .maybeSingle();

          if (authorizedAccess) {
            targetSchoolId = authorizedAccess.school_id;
            targetRole = authorizedAccess.role as UserRole;
            console.log("Acesso autorizado encontrado via Gestão de Usuários.");
          } else {
            // 2. SUB-PRIORIDADE: Checa se é o dono direto da escola (owner_email)
            const { data: ownedSchool } = await supabase
              .from('schools')
              .select('id')
              .eq('owner_email', userEmail)
              .maybeSingle();

            if (ownedSchool) {
              targetSchoolId = ownedSchool.id;
              console.log("Acesso autorizado encontrado via Dono de Escola.");
            }
          }
        }

        // Check if super admin exists (first user becomes super admin)
        const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });

        if (count === 0) {
          targetRole = 'super_admin';
          targetSchoolId = null;
        } else if (!targetSchoolId) {
          // Create new school for this user
          const { data: newSchool } = await supabase.from('schools').insert([{
            name: 'Nova Escola (Auto-Criada)',
            slug: `school-${Date.now()}`,
            active: true,
            owner_email: userEmail
          }]).select().single();
          if (newSchool) targetSchoolId = newSchool.id;
        }

        const { data: newUser, error: createError } = await supabase.from('users').insert([{
          id: userId,
          email: userEmail || 'user@system.com',
          role: targetRole,
          school_id: targetSchoolId
        }]).select().single();

        if (createError) throw createError;
        userData = newUser;
      }

      // 4. Define Estados
      if (userData) {
        setUserRole(userData.role as UserRole);
        setUserEmail(userEmail || (userData as any).email || ''); // Preference to current login
        setSchoolId(userData.school_id);

        // Gatekeeper Logic (Proteção Sênior)
        if (userData.role === 'school_admin' && userData.school_id) {
          const { data: schoolData } = await supabase
            .from('schools')
            .select('*')
            .eq('id', userData.school_id)
            .single();

          if (schoolData) {
            const today = getLocalDateString();
            const isOverdue = schoolData.subscription_due_date && schoolData.subscription_due_date < today;

            // Set Data
            setSchool(schoolData); // SET FULL OBJECT
            setSubscriptionDueDate(schoolData.subscription_due_date);
            setSchoolName(schoolData.name);

            if (!schoolData.active || isOverdue) {
              setIsSchoolBlocked(true);
              // Do not return here, let finally block handle loading state
            } else {
              // Se tudo ok, busca dados
              await fetchData(userData.school_id);
            }
          }
        } else if (userData.role === 'school_admin' && !userData.school_id) {
          // User has role but no school linked? Should probably create one or alert.
          // For now, let it pass, but fetchData won't run.
        }
      }
    } catch (error) {
      console.error("Erro no perfil de usuário:", error);
      // Do not alert here to avoid UX blocking loops, just log.
    } finally {
      setIsLoading(false);
      fetchingProfileRef.current = false;
    }
  };

  // Configurar Realtime Subscriptions
  useEffect(() => {
    if (!isAuthenticated || userRole === 'super_admin' || isSchoolBlocked || !schoolId) return;

    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => fetchData(schoolId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => fetchData(schoolId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, () => fetchData(schoolId))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, userRole, isSchoolBlocked, schoolId]);


  // fetchData pode receber um flag 'isSilent' para não bloquear a UI
  const fetchData = async (currentSchoolId: string | null) => {
    if (!currentSchoolId) return;

    try {
      let { data: classesData } = await supabase.from('classes').select('*').eq('school_id', currentSchoolId).order('name');

      // AUTO-REPAIR: Se não achou turmas na escola atual, verifica se existem em outra escola
      // Isso corrige o caso onde o Seed rodou em uma escola e o usuário está em outra
      if (!classesData || classesData.length === 0) {
        const { data: anyClass } = await supabase.from('classes').select('school_id').limit(1).single();
        if (anyClass && anyClass.school_id !== currentSchoolId) {
          console.log("Auto-Repair: Dados encontrados em outra escola. Trocando contexto...");
          // Atualiza o estado local e o usuário para a escola correta
          setSchoolId(anyClass.school_id);
          if (isAuthenticated) {
            await supabase.from('users').update({ school_id: anyClass.school_id }).eq('id', (await supabase.auth.getUser()).data.user?.id);
            showToast("Contexto atualizado para escola com dados!", "info");
          }
          // Relança o fetch com o novo ID
          return fetchData(anyClass.school_id);
        }
      }

      setClasses(classesData || []);

      const { data: studentsData } = await supabase.from('students').select('*').eq('school_id', currentSchoolId).order('name', { ascending: true });
      setStudents(studentsData || []);

      if (studentsData && studentsData.length > 0) {
        const studentIds = studentsData.map(s => s.id);
        const { data: paymentsData } = await supabase.from('payments').select('*').in('student_id', studentIds);
        setPayments(paymentsData || []);
      } else {
        setPayments([]);
      }

    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    }
  };

  const handleLogin = () => {
    // onAuthStateChange will handle this
  };

  const handleLogout = async () => {
    try {
      setIsLoading(true); // Feedback imediato
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Erro ao sair:", error);
    } finally {
      // Forçar recarregamento para limpar totalmente o estado e cache
      // Isso evita o 'travamento' que exige F5 manual
      window.location.href = '/';
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
        photo_url: studentData.photo_url
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
    console.log("📝 Editando aluno:", updatedStudent);
    try {
      const { error } = await supabase.from('students').update({
        name: updatedStudent.name,
        class_id: updatedStudent.class_id,
        monthly_fee: updatedStudent.monthly_fee,
        payment_due_day: updatedStudent.payment_due_day,
        enrollment_date: updatedStudent.enrollment_date,
        status: updatedStudent.status,
        photo_url: updatedStudent.photo_url
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
    try {
      // Manual Cascade: Remove dependências primeiro para garantir
      await supabase.from('payments').delete().eq('student_id', studentId);
      await supabase.from('attendance').delete().eq('student_id', studentId);

      const { error: studError } = await supabase.from('students').delete().eq('id', studentId);
      if (studError) throw studError;

      setStudents(prev => prev.filter(s => s.id !== studentId));
      setPayments(prev => prev.filter(p => p.student_id !== studentId));
      showToast("Aluno excluído com sucesso");
    } catch (error: any) {
      console.error(error);
      showAlert("Erro ao deletar", "Não foi possível remover o aluno. Tente novamente.", 'error');
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
          <p>Verificando credenciais...</p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-slate-500 underline hover:text-slate-300 mt-4 cursor-pointer"
          >
            Está demorando? Clique para recarregar.
          </button>
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