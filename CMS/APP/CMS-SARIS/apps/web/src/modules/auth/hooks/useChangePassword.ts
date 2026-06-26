import { useMutation } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { toast } from '@workspace/ui/components/sonner'
import i18n from '@/i18n/config'

interface ChangePasswordPayload {
  motDePasseActuel:   string
  nouveauMotDePasse:  string
}

export function useChangePassword() {
  return useMutation<void, ApiError, ChangePasswordPayload>({
    mutationFn: (dto) => api.post<void>('/auth/change-password', dto),

    onSuccess: () => {
      toast.success(i18n.t('auth.toastPasswordChanged'))
    },

    onError: (err) => {
      toast.error(err.serverMessage || i18n.t('auth.toastPasswordError'))
    },
  })
}
