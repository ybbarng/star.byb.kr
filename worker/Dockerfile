### image to use conda
FROM continuumio/miniconda3

# Import conda environment.yml
ADD environment.yml /tmp/environment.yml
RUN conda env create -f /tmp/environment.yml

# Pull the codna environment name out of the environment.yml
RUN echo "source activate $(head -1 /tmp/environment.yml | cut -d' ' -f2)" > ~/.bashrc
ENV PATH /opt/conda/envs/$(head -1 /tmp/environment.yml | cut -d' ' -f2)/bin:$PATH

# Setup working directory
WORKDIR /usr/src/worker

# Copy all local files into the image
COPY . .

# Run
CMD python -u worker.py ${WORKER}
