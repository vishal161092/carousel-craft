import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import submitCarouselTemplate from '@salesforce/apex/de_WhatsAppCarouselBuilderCtrl.submitCarouselTemplate';

export default class De_whatsAppCarouselBuilder extends LightningElement {
    templateName = '';
    language = 'en';
    category = 'MARKETING';
    headerText = '';
    bodyText = '';
    footerText = '';
    @track cards = [];
    isLoading = false;
    cardIdCounter = 0;
    buttonIdCounter = 0;

    get recordId() {
        return '000000000000000AAA';
    }

    get acceptedFormats() {
        return ['.png', '.jpg', '.jpeg', '.webp'];
    }

    get languageOptions() {
        return [
            { label: 'English', value: 'en' },
            { label: 'English (US)', value: 'en_US' },
            { label: 'Hindi', value: 'hi' },
            { label: 'Spanish', value: 'es' },
            { label: 'French', value: 'fr' },
            { label: 'Portuguese (BR)', value: 'pt_BR' },
            { label: 'Arabic', value: 'ar' }
        ];
    }

    get categoryOptions() {
        return [
            { label: 'Marketing', value: 'MARKETING' },
            { label: 'Utility', value: 'UTILITY' }
        ];
    }

    get buttonTypeOptions() {
        return [
            { label: 'Quick Reply', value: 'QUICK_REPLY' },
            { label: 'URL', value: 'URL' }
        ];
    }

    get cardCount() {
        return this.cards.length;
    }

    get hasCards() {
        return this.cards.length > 0;
    }

    get addCardDisabled() {
        return this.cards.length >= 10;
    }

    get removeCardDisabled() {
        return this.cards.length <= 0;
    }

    get submitDisabled() {
        if (this.isLoading) return true;
        if (!this.templateName) return true;
        if (this.cards.length < 2) return true;
        for (const card of this.cards) {
            if (!card.hasImage || !card.bodyText) return true;
        }
        return false;
    }

    handleTemplateNameChange(event) {
        this.templateName = event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    }

    handleLanguageChange(event) {
        this.language = event.detail.value;
    }

    handleCategoryChange(event) {
        this.category = event.detail.value;
    }

    handleHeaderTextChange(event) {
        this.headerText = event.target.value;
    }

    handleFooterTextChange(event) {
        this.footerText = event.target.value;
    }

    handleBodyTextChange(event) {
        this.bodyText = event.target.value;
    }

    handleAddCard() {
        if (this.cards.length >= 10) return;
        this.cardIdCounter++;
        this.cards = [
            ...this.cards,
            {
                id: 'card-' + this.cardIdCounter,
                index: this.cards.length + 1,
                bodyText: '',
                hasImage: false,
                fileName: '',
                contentVersionId: null,
                buttons: [],
                hasButtons: false,
                canAddButton: true
            }
        ];
    }

    handleRemoveCard(event) {
        const cardId = event.currentTarget.dataset.cardId;
        this.cards = this.cards
            .filter(c => c.id !== cardId)
            .map((c, idx) => ({ ...c, index: idx + 1 }));
    }

    handleUploadFinished(event) {
        const uploadedFiles = event.detail.files;
        const cardId = event.currentTarget.dataset.cardId;

        if (uploadedFiles && uploadedFiles.length > 0) {
            const file = uploadedFiles[0];
            this.cards = this.cards.map(c => {
                if (c.id === cardId) {
                    return {
                        ...c,
                        hasImage: true,
                        fileName: file.name,
                        contentVersionId: file.contentVersionId
                    };
                }
                return c;
            });
        }
    }

    handleRemoveImage(event) {
        const cardId = event.currentTarget.dataset.cardId;
        this.cards = this.cards.map(c => {
            if (c.id === cardId) {
                return { ...c, hasImage: false, fileName: '', contentVersionId: null };
            }
            return c;
        });
    }

    handleCardBodyChange(event) {
        const cardId = event.currentTarget.dataset.cardId;
        const value = event.target.value;
        this.cards = this.cards.map(c => {
            if (c.id === cardId) {
                return { ...c, bodyText: value };
            }
            return c;
        });
    }

    handleAddButton(event) {
        const cardId = event.currentTarget.dataset.cardId;
        this.buttonIdCounter++;
        this.cards = this.cards.map(c => {
            if (c.id === cardId && c.buttons.length < 2) {
                const newButtons = [
                    ...c.buttons,
                    {
                        id: 'btn-' + this.buttonIdCounter,
                        type: 'QUICK_REPLY',
                        text: '',
                        url: '',
                        payload: '',
                        isUrl: false
                    }
                ];
                return {
                    ...c,
                    buttons: newButtons,
                    hasButtons: true,
                    canAddButton: newButtons.length < 2
                };
            }
            return c;
        });
    }

    handleRemoveButton(event) {
        const cardId = event.currentTarget.dataset.cardId;
        const btnId = event.currentTarget.dataset.btnId;
        this.cards = this.cards.map(c => {
            if (c.id === cardId) {
                const newButtons = c.buttons.filter(b => b.id !== btnId);
                return {
                    ...c,
                    buttons: newButtons,
                    hasButtons: newButtons.length > 0,
                    canAddButton: newButtons.length < 2
                };
            }
            return c;
        });
    }

    handleButtonTypeChange(event) {
        const cardId = event.currentTarget.dataset.cardId;
        const btnId = event.currentTarget.dataset.btnId;
        const value = event.detail.value;
        this.cards = this.cards.map(c => {
            if (c.id === cardId) {
                return {
                    ...c,
                    buttons: c.buttons.map(b => {
                        if (b.id === btnId) {
                            return { ...b, type: value, isUrl: value === 'URL' };
                        }
                        return b;
                    })
                };
            }
            return c;
        });
    }

    handleButtonTextChange(event) {
        const cardId = event.currentTarget.dataset.cardId;
        const btnId = event.currentTarget.dataset.btnId;
        const value = event.target.value;
        this.cards = this.cards.map(c => {
            if (c.id === cardId) {
                return {
                    ...c,
                    buttons: c.buttons.map(b => {
                        if (b.id === btnId) return { ...b, text: value };
                        return b;
                    })
                };
            }
            return c;
        });
    }

    handleButtonUrlChange(event) {
        const cardId = event.currentTarget.dataset.cardId;
        const btnId = event.currentTarget.dataset.btnId;
        const value = event.target.value;
        this.cards = this.cards.map(c => {
            if (c.id === cardId) {
                return {
                    ...c,
                    buttons: c.buttons.map(b => {
                        if (b.id === btnId) return { ...b, url: value };
                        return b;
                    })
                };
            }
            return c;
        });
    }

    async handleSubmit() {
        if (this.submitDisabled) return;

        this.isLoading = true;

        try {
            const cardsPayload = this.cards.map(c => ({
                contentVersionId: c.contentVersionId,
                bodyText: c.bodyText,
                buttons: c.buttons.map(b => ({
                    type: b.type,
                    text: b.text,
                    url: b.url || null,
                    payload: b.type === 'QUICK_REPLY' ? b.text : null
                }))
            }));

            const result = await submitCarouselTemplate({
                templateName: this.templateName,
                language: this.language,
                category: this.category,
                headerText: this.headerText,
                bodyText: this.bodyText,
                footerText: this.footerText,
                cardsJson: JSON.stringify(cardsPayload)
            });

            if (result.success) {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Template Submitted!',
                        message: `Template ID: ${result.templateId} — Status: ${result.templateStatus}. Meta will review and approve shortly.`,
                        variant: 'success'
                    })
                );
                this.resetForm();
            } else {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Submission Failed',
                        message: result.errorMessage,
                        variant: 'error',
                        mode: 'sticky'
                    })
                );
            }
        } catch (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: error.body ? error.body.message : error.message,
                    variant: 'error',
                    mode: 'sticky'
                })
            );
        } finally {
            this.isLoading = false;
        }
    }

    resetForm() {
        this.templateName = '';
        this.headerText = '';
        this.bodyText = '';
        this.footerText = '';
        this.cards = [];
        this.language = 'en';
        this.category = 'MARKETING';
    }
}
