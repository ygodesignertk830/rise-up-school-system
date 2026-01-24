import Swal from 'sweetalert2';

// Base Configuration for Dark Theme
const toastMixin = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    background: '#1e293b',
    color: '#fff',
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer)
        toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
});

const modalMixin = Swal.mixin({
    background: '#1e293b',
    color: '#fff',
    confirmButtonColor: '#7c3aed', // Purple
    cancelButtonColor: '#ef4444', // Red
    buttonsStyling: true,
    customClass: {
        popup: 'border border-slate-700 rounded-2xl shadow-xl',
        title: 'text-2xl font-bold text-white',
        htmlContainer: 'text-slate-300',
        confirmButton: 'px-6 py-3 rounded-xl font-bold text-white bg-purple-600 hover:bg-purple-500 transition-colors mx-2',
        cancelButton: 'px-6 py-3 rounded-xl font-bold text-white bg-slate-700 hover:bg-slate-600 transition-colors mx-2'
    }
});

// Exposed Functions

export const showAlert = (title: string, text: string, icon: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    return modalMixin.fire({
        title,
        text,
        icon
    });
};

export const showToast = (title: string, icon: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    return toastMixin.fire({
        icon,
        title
    });
};

export const showConfirm = async (title: string, text: string): Promise<boolean> => {
    const result = await modalMixin.fire({
        title,
        text,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sim, confirmar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true
    });
    return result.isConfirmed;
};
