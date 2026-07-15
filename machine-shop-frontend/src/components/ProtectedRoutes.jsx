import React, { useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { AuthContext } from '../context/AuthProvider';

export const ProtectedRoutes = ({ children, roles }) => {
    const navigate = useNavigate();
    const { user, setUser } = useContext(AuthContext);

    useEffect(() => {

        const token = localStorage.getItem('token');

        if (!token) {
            navigate('/');
            return;
        }

        try {
            const decoded = jwtDecode(token);

            if (!user) {
                setUser({
                    ...decoded,
                    rolId: decoded.RolId  // ← Usar RolId del token
                });
            }

            // Verificar expiración
            if (decoded.exp * 1000 < Date.now()) {
                localStorage.removeItem('token');
                navigate('/');
                return;
            }
            const userRol = user?.rolId ?? decoded.RolId; // ← Usar RolId del token si user es null


            if (roles && !roles.includes(userRol)) {
                navigate('/unauthorized');
                return;
            }

            console.log("✅ ACCESO CONCEDIDO");

        } catch (e) {
            console.error('❌ Token invalido:', e);
            localStorage.removeItem('token');
            navigate('/');
        }
    }, [navigate, user, setUser, roles]);

    return children;
}
export default ProtectedRoutes;
