document.addEventListener('DOMContentLoaded', () => {
    // --- Scroll Animations ---
    const revealElements = document.querySelectorAll('.scroll-reveal');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    revealElements.forEach(el => observer.observe(el));

    // --- Input Sync ---
    const features = ['sepal_length', 'sepal_width', 'petal_length', 'petal_width'];
    
    features.forEach(feature => {
        const slider = document.getElementById(`${feature}_slider`);
        const numInput = document.getElementById(feature);
        
        slider.addEventListener('input', (e) => {
            numInput.value = e.target.value;
        });
        
        numInput.addEventListener('input', (e) => {
            // Ensure within bounds visually
            let val = parseFloat(e.target.value);
            let min = parseFloat(slider.min);
            let max = parseFloat(slider.max);
            
            if(val >= min && val <= max) {
                slider.value = val;
            }
        });
        
        numInput.addEventListener('change', (e) => {
             // Enforce bounds on blur/change
             let val = parseFloat(e.target.value);
             let min = parseFloat(slider.min);
             let max = parseFloat(slider.max);
             if(isNaN(val) || val < min) val = min;
             if(val > max) val = max;
             e.target.value = val;
             slider.value = val;
        });
    });

    // --- Initialization: Fetch Data ---
    fetchDatasetStats();
    // fetchModelInfo(); // Optional, currently hardcoded in HTML but could be dynamic

    // --- Predict Action ---
    const classifyBtn = document.getElementById('classify-btn');
    const resultArea = document.getElementById('result-area');
    
    classifyBtn.addEventListener('click', async () => {
        // Collect values
        const data = {
            sepal_length: parseFloat(document.getElementById('sepal_length').value),
            sepal_width: parseFloat(document.getElementById('sepal_width').value),
            petal_length: parseFloat(document.getElementById('petal_length').value),
            petal_width: parseFloat(document.getElementById('petal_width').value)
        };

        // UI Loading State
        classifyBtn.classList.add('loading');
        classifyBtn.disabled = true;
        
        // Hide result area if visible
        resultArea.classList.add('hidden');
        
        try {
            const response = await fetch('/predict', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) throw new Error('Prediction failed');
            
            const result = await response.json();
            
            // Artificial delay for effect
            setTimeout(() => {
                displayResult(result);
                classifyBtn.classList.remove('loading');
                classifyBtn.disabled = false;
            }, 800);

        } catch (error) {
            console.error('Error:', error);
            alert('Failed to get prediction. Ensure backend is running.');
            classifyBtn.classList.remove('loading');
            classifyBtn.disabled = false;
        }
    });

});

const emojis = {
    'Iris-setosa': '🌿',
    'Iris-versicolor': '🌺',
    'Iris-virginica': '💜'
};

const colors = {
    'Iris-setosa': 'var(--setosa)',
    'Iris-versicolor': 'var(--versicolor)',
    'Iris-virginica': 'var(--virginica)'
};

function displayResult(data) {
    const resultArea = document.getElementById('result-area');
    const predictedSpeciesEl = document.getElementById('predicted-species');
    const confidenceMeter = document.querySelector('.confidence-meter');
    const confidenceValue = document.getElementById('confidence-value');
    
    const species = data.species;
    const conf = (data.confidence * 100).toFixed(1);
    
    // Set Header
    predictedSpeciesEl.textContent = `${species.replace('Iris-', 'Iris ')} ${emojis[species]}`;
    predictedSpeciesEl.style.color = colors[species];
    
    // Reset animations
    confidenceMeter.style.setProperty('--confidence', 0);
    confidenceValue.textContent = '0%';
    document.getElementById('prob-setosa').style.width = '0%';
    document.getElementById('prob-versicolor').style.width = '0%';
    document.getElementById('prob-virginica').style.width = '0%';
    
    // Show area
    resultArea.classList.remove('hidden');
    
    // Animate Confidence
    setTimeout(() => {
        confidenceMeter.style.setProperty('--confidence', conf);
        
        // Counter animation for text
        let start = 0;
        const duration = 1000;
        const stepTime = Math.abs(Math.floor(duration / conf));
        
        let timer = setInterval(() => {
            start += 1;
            confidenceValue.textContent = `${start}%`;
            if (start >= Math.floor(conf)) {
                confidenceValue.textContent = `${conf}%`;
                clearInterval(timer);
            }
        }, stepTime);
        
        // Animate Bars
        if(data.probabilities) {
            const probs = data.probabilities;
            
            document.getElementById('prob-setosa').style.width = `${(probs['Iris-setosa'] * 100).toFixed(1)}%`;
            document.getElementById('val-setosa').textContent = `${(probs['Iris-setosa'] * 100).toFixed(1)}%`;
            
            document.getElementById('prob-versicolor').style.width = `${(probs['Iris-versicolor'] * 100).toFixed(1)}%`;
            document.getElementById('val-versicolor').textContent = `${(probs['Iris-versicolor'] * 100).toFixed(1)}%`;
            
            document.getElementById('prob-virginica').style.width = `${(probs['Iris-virginica'] * 100).toFixed(1)}%`;
            document.getElementById('val-virginica').textContent = `${(probs['Iris-virginica'] * 100).toFixed(1)}%`;
        }

    }, 50);
}

async function fetchDatasetStats() {
    try {
        const response = await fetch('/api/dataset-stats');
        if (!response.ok) return; // Silent fail if backend not ready
        
        const data = await response.json();
        
        document.getElementById('total-samples').textContent = data.total_samples || '--';
        
        if (data.species_counts) {
            document.getElementById('count-setosa').textContent = data.species_counts['Iris-setosa'] || 0;
            document.getElementById('count-versicolor').textContent = data.species_counts['Iris-versicolor'] || 0;
            document.getElementById('count-virginica').textContent = data.species_counts['Iris-virginica'] || 0;
        }
        
        if (data.feature_stats) {
            const grid = document.getElementById('feature-stats-grid');
            grid.innerHTML = '';
            
            for (const [feat, stats] of Object.entries(data.feature_stats)) {
                const name = feat.replace('_', ' ');
                const html = `
                    <div class="feat-stat-card">
                        <h4>${name}</h4>
                        <div class="feat-stat-row"><span>Min:</span> <span>${stats.min.toFixed(2)}</span></div>
                        <div class="feat-stat-row"><span>Max:</span> <span>${stats.max.toFixed(2)}</span></div>
                        <div class="feat-stat-row"><span>Mean:</span> <span>${stats.mean.toFixed(2)}</span></div>
                        <div class="feat-stat-row"><span>Std:</span> <span>${stats.std.toFixed(2)}</span></div>
                    </div>
                `;
                grid.innerHTML += html;
            }
        }
    } catch (e) {
        console.log('Dataset stats not available yet.');
        document.getElementById('feature-stats-grid').innerHTML = '<div class="loading-text">Statistics could not be loaded.</div>';
    }
}
