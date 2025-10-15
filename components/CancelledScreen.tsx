import React from 'react';

interface CancelledScreenProps {
    onReset: () => void;
}

export const CancelledScreen: React.FC<CancelledScreenProps> = ({ onReset }) => {
    return (
        <div className="text-center p-8 bg-slate-900/50 rounded-xl shadow-2xl border border-cyan-500/10">
            <h2 className="text-3xl font-bold text-cyan-400 mb-4">分析已取消</h2>
            <p className="text-slate-400 mb-8">所有处理已停止，相关进度（如果未在完成后清除）可能已从浏览器缓存中移除。</p>
            <button
                onClick={onReset} 
                className="px-10 py-4 bg-gradient-to-br from-cyan-600 to-sky-700 hover:from-cyan-500 hover:to-sky-600 text-white font-semibold rounded-lg shadow-md hover:shadow-cyan-500/20 transition-all duration-200 transform hover:-translate-y-0.5 text-lg"
            >
                开始新的分析
            </button>
        </div>
    );
};
