import { useCallback, useMemo, useState } from 'react';
import AuthContext from './AuthContext';

function Parent({ sessionId, children }) {
    const [currentUserId, setCurrentUserId] = useState(42);

    const login = useCallback((loginData) => {
        /*
            do some other user relate operations
            ...
        */
        setCurrentUserId(loginData.id);
    }, []);

    const contextValues = useMemo(() => {
        return {
            currentUserId,
            login
        }
    }, [currentUserId, login]);
  
    return (
        <AuthContext.Provider value={contextValues}>
            <div className='parent-wrapper'>
                <b>Session ID: { sessionId }</b>
                <i>Parent</i>
                <div className='parent'>
                    { children }
                </div>
            </div>
        </AuthContext.Provider>
    );
}

export default Parent;