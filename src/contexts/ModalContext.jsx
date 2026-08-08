/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState } from 'react';
import ConfirmModal from '../components/ConfirmModal.jsx';

const ModalContext = createContext(null);

const initialModalState = {
  open: false,
  type: 'input',
  title: '',
  inputValue: '',
  onConfirm: null,
  confirmText: '确定',
  confirmVariant: 'primary',
};

export function ModalProvider({ children }) {
  const [modal, setModal] = useState(initialModalState);

  const openInputModal = (title, defaultValue, onConfirm) => {
    setModal({
      open: true,
      type: 'input',
      title,
      inputValue: String(defaultValue ?? ''),
      onConfirm,
      confirmText: '确定保存',
      confirmVariant: 'primary',
    });
  };

  const openConfirmModal = (title, onConfirm, opts = {}) => {
    const { confirmText, confirmVariant } = opts;
    setModal({
      open: true,
      type: 'confirm',
      title,
      inputValue: '',
      onConfirm,
      confirmText: confirmText ?? '确定',
      confirmVariant: confirmVariant === 'danger' ? 'danger' : 'primary',
    });
  };

  const closeModal = () => {
    setModal((prev) => ({ ...prev, open: false }));
  };

  const handleModalSubmit = () => {
    if (modal.onConfirm) {
      modal.onConfirm(modal.inputValue);
    }
    closeModal();
  };

  const setModalInputValue = (inputValue) => {
    setModal((prev) => ({ ...prev, inputValue }));
  };

  const value = {
    openInputModal,
    openConfirmModal,
    closeModal,
    handleModalSubmit,
    setModalInputValue,
  };

  return (
    <ModalContext.Provider value={value}>
      {children}
      <ConfirmModal
        modal={modal}
        onSubmit={handleModalSubmit}
        onClose={closeModal}
        onInputChange={setModalInputValue}
      />
    </ModalContext.Provider>
  );
}

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within ModalProvider');
  return ctx;
}
