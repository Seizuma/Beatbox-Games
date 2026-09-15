import { useEffect } from 'react';

const SEO = ({
    title = "BeatBox Games - Blind Test Musical & Univers Beatbox | Jeu Multijoueur Gratuit",
    description = "Plongez dans l'univers du beatbox avec BeatBox Games ! Blind Test musical multijoueur, découvrez les plus grands beatboxers, créez votre room privée et défiez vos amis. Jeu gratuit sans inscription.",
    keywords = "beatbox, beatboxer, blind test, jeu musical, human beatbox, beatmaking, vocal percussion, battle beatbox, freestyle beatbox, multijoueur, en ligne, gratuit, party game, musique urbaine, hip hop, beatbox français",
    ogImage = "https://beatboxgames.com/og-beatbox-image.jpg",
    url = "https://beatboxgames.com",
    type = "website"
}) => {
    useEffect(() => {
        // Mise à jour du titre
        document.title = title;

        // Mise à jour de la description
        updateMetaTag('name', 'description', description);
        updateMetaTag('name', 'keywords', keywords);

        // Mise à jour des balises Open Graph
        updateMetaTag('property', 'og:title', title);
        updateMetaTag('property', 'og:description', description);
        updateMetaTag('property', 'og:image', ogImage);
        updateMetaTag('property', 'og:url', url);
        updateMetaTag('property', 'og:type', type);

        // Mise à jour des balises Twitter
        updateMetaTag('name', 'twitter:title', title);
        updateMetaTag('name', 'twitter:description', description);
        updateMetaTag('name', 'twitter:image', ogImage);

        // Mise à jour de l'URL canonique
        updateCanonicalLink(url);

        // ✅ NOUVEAU : Mise à jour du theme-color pour les favicons
        updateMetaTag('name', 'theme-color', '#06b6d4');
        updateMetaTag('name', 'msapplication-TileColor', '#06b6d4');

    }, [title, description, keywords, ogImage, url, type]);

    const updateMetaTag = (attribute, attributeValue, content) => {
        let element = document.querySelector(`meta[${attribute}="${attributeValue}"]`);
        if (element) {
            element.setAttribute('content', content);
        } else {
            element = document.createElement('meta');
            element.setAttribute(attribute, attributeValue);
            element.setAttribute('content', content);
            document.getElementsByTagName('head')[0].appendChild(element);
        }
    };

    const updateCanonicalLink = (href) => {
        let canonicalLink = document.querySelector('link[rel="canonical"]');
        if (canonicalLink) {
            canonicalLink.setAttribute('href', href);
        } else {
            canonicalLink = document.createElement('link');
            canonicalLink.setAttribute('rel', 'canonical');
            canonicalLink.setAttribute('href', href);
            document.getElementsByTagName('head')[0].appendChild(canonicalLink);
        }
    };

    return null;
};

export default SEO;