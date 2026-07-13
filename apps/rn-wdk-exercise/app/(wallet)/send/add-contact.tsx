// The same add-contact form, mounted inside the send stack so it can present as a
// modal STACKED on top of the contact picker (pushing the (wallet)-level route from
// the picker would land behind the native sheet). Re-export keeps one implementation.
export { default } from '../address-book/add';
