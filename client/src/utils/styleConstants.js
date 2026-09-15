/**
 * Constantes de styles pour maintenir la cohérence visuelle
 * Utilisées dans toute l'application
 */

export const STYLES = {
    // Arrière-plans modernes
    modernBackground: "min-h-screen bg-gradient-to-br from-zinc-900 via-purple-900/20 to-zinc-800 relative overflow-hidden",

    // Cartes et conteneurs
    modernCard: "bg-gradient-to-br from-zinc-800/90 to-zinc-900/90 backdrop-blur-sm border border-zinc-700/50 rounded-3xl shadow-2xl",

    // Boutons
    modernButton: "bg-gradient-to-r from-cyan-400 to-purple-500 hover:from-cyan-300 hover:to-purple-400 text-white font-bold rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg",

    // Inputs
    modernInput: "bg-zinc-700/50 backdrop-blur-sm border border-zinc-600/50 rounded-xl text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 transition-all duration-300",

    // Boutons secondaires
    secondaryButton: "bg-zinc-700/50 hover:bg-zinc-600/50 text-white font-medium rounded-xl transition-all duration-300",

    // Boutons de danger
    dangerButton: "bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-400 hover:to-pink-400 text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-105",

    // Boutons de succès
    successButton: "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-105",

    // Badges et indicateurs
    badge: "px-3 py-1 rounded-full text-xs font-bold",

    // Cartes de contenu
    contentCard: "bg-zinc-700/30 backdrop-blur-sm rounded-xl border border-zinc-600/30",

    // Textes dégradés
    gradientText: "bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent",
    titleGradient: "bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent",

    // États d'erreur et succès
    errorContainer: "bg-gradient-to-r from-red-500/20 to-pink-500/20 border border-red-500/30 rounded-xl",
    successContainer: "bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl",
    warningContainer: "bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-xl",
    infoContainer: "bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-xl",
};