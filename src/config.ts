export const ADMIN_EMAILS = [
  'joaopsfarma@gmail.com',
  // Adicione novos e-mails de administradores aqui
];

export const isAdminUser = (email: string | null | undefined) => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email);
};
