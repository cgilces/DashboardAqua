export interface User {
  id: number | string;
  username: string;
  role: string;
  assigned_routes: string[];
  // Módulos que el usuario puede ver (privilegios editables desde la UI).
  // Vacío/ausente = usa los permisos por defecto del rol/canal.
  allowed_modules?: string[];
}
